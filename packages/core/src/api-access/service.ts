/** SOURCE OF TRUTH: MCP & API access — WHAT: access tokens, OAuth for AI clients, the activity log / WHY: every grant is capped by role and areas */
/**
 * Settings → MCP & API, the server side: access tokens for scripts, OAuth for AI clients
 * (RFC 6749 code flow with PKCE, RFC 7591 registration), the activity log and the three
 * switches. Every grant acts for one member of one store and is capped twice: by that
 * member's role (read fresh on every call) and by the areas the grant names.
 *
 * Secrets (tokens, refresh tokens, sign-in codes, client secrets) are stored only as SHA-256
 * hashes; the plain value is returned once. Before a store is known, lookups go through the
 * SECURITY DEFINER functions in migration 0130 (RLS hides every row until then).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  type AiActionStatus,
  type ApiActivityKind,
  type ApiGrantKind,
  aiAction,
  apiActivity,
  apiAuthCode,
  apiAuthCodeStore,
  apiGrant,
  apiGrantForAccess,
  apiGrantForRefresh,
  authSchema,
  type Db,
  oauthClient,
  role,
  type StoreTx,
  store,
  storeMember,
  withStore,
} from '@commerce/db'
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { memberAccess } from '../permissions/service'
import { ALL_PERMISSIONS, type Permission } from '../permissions/statement'
import {
  API_ACTIVITY_DAYS,
  type ApiActivityFilter,
  type ApiScopes,
  ApiScopesSchema,
  type CreateTokenInput,
  CreateTokenSchema,
  type McpClientId,
  type McpSettings,
  McpSettingsSchema,
  mcpClientOf,
  parseMcpSettings,
  permissionsForScopes,
} from './client'

const DAY = 86_400_000

/** Lifetimes. Access tokens are short so a revoke or a role change bites within the hour. */
const OAUTH_ACCESS_TTL_MS = 60 * 60_000
const OAUTH_REFRESH_TTL_MS = 30 * DAY
const OAUTH_CODE_TTL_MS = 5 * 60_000

/** Prefixes make a leaked secret recognisable (and greppable by secret scanners). */
const TOKEN_PREFIX = 'kmc_live_'
const ACCESS_PREFIX = 'kmo_'
const REFRESH_PREFIX = 'kmr_'
const CODE_PREFIX = 'kmz_'
const CLIENT_PREFIX = 'kmcl_'
const CLIENT_SECRET_PREFIX = 'kmcs_'

const hashSecret = (value: string): string => createHash('sha256').update(value).digest('hex')

const newSecret = (prefix: string): string => `${prefix}${randomBytes(24).toString('base64url')}`

const hintOf = (secret: string): string => `kmc_…${secret.slice(-4)}`

/** "13.233.41.7" → "13.233.x.x"; IPv6 keeps its first two groups. */
function maskApiIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const v4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/)
  if (v4) return `${v4[1]}.${v4[2]}.x.x`
  const groups = ip.split(':').filter(Boolean)
  return groups.length >= 2 ? `${groups[0]}:${groups[1]}:x` : null
}

/* ---------- settings ---------- */

export async function loadMcpSettings(ctx: StoreContext): Promise<McpSettings> {
  const [row] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseMcpSettings(row?.preferences)
}

export async function saveMcpSettings(ctx: StoreContext, input: unknown): Promise<McpSettings> {
  const next = McpSettingsSchema.parse(input)
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ mcp: next })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
  return next
}

/* ---------- grants ---------- */

export type ApiGrantStatus = 'active' | 'expired'

export type ApiGrantView = {
  id: string
  kind: ApiGrantKind
  name: string
  /** The known AI tool an OAuth client is, for its logo; null for tokens and unknown clients. */
  client: McpClientId | null
  hint: string
  scopes: ApiScopes
  member: { name: string; role: string } | null
  createdAt: Date
  lastUsedAt: Date | null
  lastIp: string | null
  /** Tokens: when it stops working (null = never). OAuth: when the sign-in lapses unused. */
  expiresAt: Date | null
  status: ApiGrantStatus
}

type GrantRow = typeof apiGrant.$inferSelect

function expiryOf(row: GrantRow): Date | null {
  return row.kind === 'token' ? row.accessExpiresAt : row.refreshExpiresAt
}

/** Who each member is and what their role is called, for the lists. */
async function membersById(tx: StoreTx, storeId: string, userIds: string[]) {
  if (!userIds.length) return new Map<string, { name: string; role: string }>()
  const rows = await tx
    .select({ userId: storeMember.userId, name: authSchema.user.name, role: role.name })
    .from(storeMember)
    .innerJoin(role, eq(role.id, storeMember.roleId))
    .innerJoin(authSchema.user, eq(authSchema.user.id, storeMember.userId))
    .where(and(eq(storeMember.storeId, storeId), inArray(storeMember.userId, userIds)))
  return new Map(rows.map((r) => [r.userId, { name: r.name, role: r.role }]))
}

function viewOf(
  row: GrantRow,
  members: Map<string, { name: string; role: string }>,
  now: Date,
): ApiGrantView {
  const expiresAt = expiryOf(row)
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    client: row.kind === 'oauth' ? mcpClientOf(row.name) : null,
    hint: row.hint,
    scopes: row.scopes as ApiScopes,
    member: members.get(row.userId) ?? null,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    lastIp: row.lastIp,
    expiresAt,
    status: expiresAt && expiresAt.getTime() <= now.getTime() ? 'expired' : 'active',
  }
}

/** Connected clients and access tokens, newest first; revoked ones are gone from the lists. */
export async function listApiGrants(
  ctx: StoreContext,
  now = new Date(),
): Promise<{ clients: ApiGrantView[]; tokens: ApiGrantView[] }> {
  const rows = await ctx.tx
    .select()
    .from(apiGrant)
    .where(isNull(apiGrant.revokedAt))
    .orderBy(desc(apiGrant.createdAt))
  const members = await membersById(ctx.tx, ctx.storeId, [...new Set(rows.map((r) => r.userId))])
  const views = rows.map((r) => viewOf(r, members, now))
  return {
    clients: views.filter((v) => v.kind === 'oauth'),
    tokens: views.filter((v) => v.kind === 'token'),
  }
}

async function memberName(tx: StoreTx, userId: string): Promise<string> {
  const [row] = await tx
    .select({ name: authSchema.user.name })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId))
  return row?.name ?? 'Someone'
}

const areaList = (scopes: ApiScopes): string =>
  Object.keys(scopes)
    .map((a) => a.replace('_', ' '))
    .join(', ')

/** Create token: the plain token is in the answer once and never again. */
export async function createAccessToken(
  ctx: StoreContext,
  userId: string,
  input: CreateTokenInput,
  now = new Date(),
): Promise<{ token: string; grant: ApiGrantView }> {
  const req = CreateTokenSchema.parse(input)
  const token = newSecret(TOKEN_PREFIX)
  const [row] = await ctx.tx
    .insert(apiGrant)
    .values({
      storeId: ctx.storeId,
      kind: 'token',
      name: req.name,
      userId,
      scopes: req.scopes,
      hint: hintOf(token),
      accessHash: hashSecret(token),
      accessExpiresAt: req.expiresInDays ? new Date(now.getTime() + req.expiresInDays * DAY) : null,
      createdAt: now,
    })
    .returning()
  if (!row) throw new Error('token insert returned nothing')
  await recordApiActivity(ctx.tx, ctx.storeId, {
    grantId: row.id,
    kind: 'connected',
    summary: `Access token "${req.name}" created`,
    detail: `By ${await memberName(ctx.tx, userId)} · ${areaList(req.scopes)}`,
    at: now,
  })
  const members = await membersById(ctx.tx, ctx.storeId, [userId])
  return { token, grant: viewOf(row, members, now) }
}

/** Revoke: the client or token stops working on its next call. Waiting approvals stay. */
export async function revokeApiGrant(
  ctx: StoreContext,
  id: string,
  by: string,
  now = new Date(),
): Promise<boolean> {
  const [row] = await ctx.tx
    .update(apiGrant)
    .set({ revokedAt: now, revokedBy: by })
    .where(and(eq(apiGrant.id, id), isNull(apiGrant.revokedAt)))
    .returning()
  if (!row) return false
  await recordApiActivity(ctx.tx, ctx.storeId, {
    grantId: row.id,
    kind: 'revoked',
    summary:
      row.kind === 'oauth' ? `${row.name} disconnected` : `Access token "${row.name}" revoked`,
    detail: `By ${await memberName(ctx.tx, by)}`,
    at: now,
  })
  return true
}

/* ---------- activity ---------- */

export type ApiActivityInput = {
  grantId: string | null
  kind: ApiActivityKind
  tool?: string | null
  summary: string
  detail?: string | null
  aiActionId?: string | null
  at?: Date
}

export async function recordApiActivity(
  tx: StoreTx,
  storeId: string,
  input: ApiActivityInput,
): Promise<void> {
  await tx.insert(apiActivity).values({
    storeId,
    grantId: input.grantId,
    kind: input.kind,
    tool: input.tool ?? null,
    summary: input.summary.slice(0, 300),
    detail: input.detail?.slice(0, 500) ?? null,
    aiActionId: input.aiActionId ?? null,
    createdAt: input.at ?? new Date(),
  })
}

/** A read by the same grant and tool within this window is one log row, not one per call. */
const READ_COALESCE_MS = 10 * 60_000

/** Logs a read unless the same grant logged the same read in the last ten minutes. */
export async function recordApiRead(
  tx: StoreTx,
  storeId: string,
  input: Omit<ApiActivityInput, 'kind'>,
): Promise<void> {
  const at = input.at ?? new Date()
  const [recent] = await tx
    .select({ id: apiActivity.id })
    .from(apiActivity)
    .where(
      and(
        eq(apiActivity.kind, 'read'),
        input.grantId ? eq(apiActivity.grantId, input.grantId) : isNull(apiActivity.grantId),
        eq(apiActivity.tool, input.tool ?? ''),
        gte(apiActivity.createdAt, new Date(at.getTime() - READ_COALESCE_MS)),
      ),
    )
    .limit(1)
  if (recent) return
  await recordApiActivity(tx, storeId, { ...input, kind: 'read', at })
}

export type ApiActivityView = {
  id: string
  kind: ApiActivityKind
  summary: string
  detail: string | null
  /** The approval a change waits in, while it is still open. */
  approvalId: string | null
  /**
   * Where the AI action behind the row stands now (`expired` once its time ran out, even
   * before Activity marks it), so a "waiting approval" row does not read as still waiting.
   */
  approvalStatus: AiActionStatus | null
  createdAt: Date
}

export type ApiActivityPage = {
  items: ApiActivityView[]
  counts: Record<ApiActivityFilter, number>
  /** Pass as `before` for the next page; null on the last one. */
  next: string | null
}

const FILTER_KINDS: Record<Exclude<ApiActivityFilter, 'all'>, ApiActivityKind[]> = {
  read: ['read'],
  change: ['change'],
  approval: ['approval'],
  blocked: ['blocked'],
}

export const ApiActivityQuerySchema = z.object({
  filter: z.enum(['all', 'read', 'change', 'approval', 'blocked']).default('all'),
  /** The `createdAt` of the last row already shown (ISO). */
  before: z.string().datetime().nullable().default(null),
  limit: z.number().int().min(1).max(100).default(30),
})
export type ApiActivityQuery = z.input<typeof ApiActivityQuerySchema>

/** The last 90 days, newest first, with how many rows each filter holds. */
export async function listApiActivity(
  ctx: StoreContext,
  query: ApiActivityQuery,
  now = new Date(),
): Promise<ApiActivityPage> {
  const q = ApiActivityQuerySchema.parse(query)
  const since = new Date(now.getTime() - API_ACTIVITY_DAYS * DAY)
  const window = gte(apiActivity.createdAt, since)
  const where = [window]
  if (q.filter !== 'all') where.push(inArray(apiActivity.kind, FILTER_KINDS[q.filter]))
  if (q.before) where.push(lt(apiActivity.createdAt, new Date(q.before)))
  const [rows, grouped] = await Promise.all([
    ctx.tx
      .select({
        id: apiActivity.id,
        kind: apiActivity.kind,
        summary: apiActivity.summary,
        detail: apiActivity.detail,
        aiActionId: apiActivity.aiActionId,
        approval: aiAction.status,
        approvalExpiresAt: aiAction.expiresAt,
        createdAt: apiActivity.createdAt,
      })
      .from(apiActivity)
      .leftJoin(aiAction, eq(aiAction.id, apiActivity.aiActionId))
      .where(and(...where))
      .orderBy(desc(apiActivity.createdAt))
      .limit(q.limit + 1),
    ctx.tx
      .select({ kind: apiActivity.kind, n: sql<number>`count(*)::int` })
      .from(apiActivity)
      .where(window)
      .groupBy(apiActivity.kind),
  ])
  const by = new Map(grouped.map((g) => [g.kind, g.n]))
  const sum = (kinds: ApiActivityKind[]) => kinds.reduce((t, k) => t + (by.get(k) ?? 0), 0)
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return {
    items: page.map((r) => {
      const approvalStatus: AiActionStatus | null =
        r.approval === 'proposed' && r.approvalExpiresAt && r.approvalExpiresAt <= now
          ? 'expired'
          : r.approval
      return {
        id: r.id,
        kind: r.kind,
        summary: r.summary,
        detail: r.detail,
        approvalId: r.aiActionId && approvalStatus === 'proposed' ? r.aiActionId : null,
        approvalStatus,
        createdAt: r.createdAt,
      }
    }),
    counts: {
      all: [...by.values()].reduce((t, n) => t + n, 0),
      read: sum(FILTER_KINDS.read),
      change: sum(FILTER_KINDS.change),
      approval: sum(FILTER_KINDS.approval),
      blocked: sum(FILTER_KINDS.blocked),
    },
    next: rows.length > q.limit && last ? last.createdAt.toISOString() : null,
  }
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Export CSV: every row of the last 90 days. */
export async function apiActivityCsv(ctx: StoreContext, now = new Date()): Promise<string> {
  const since = new Date(now.getTime() - API_ACTIVITY_DAYS * DAY)
  const rows = await ctx.tx
    .select({
      createdAt: apiActivity.createdAt,
      kind: apiActivity.kind,
      tool: apiActivity.tool,
      summary: apiActivity.summary,
      detail: apiActivity.detail,
    })
    .from(apiActivity)
    .where(gte(apiActivity.createdAt, since))
    .orderBy(desc(apiActivity.createdAt))
    .limit(50_000)
  const lines = [['Time', 'Kind', 'Tool', 'What happened', 'Details'].join(',')]
  for (const r of rows) {
    lines.push(
      [r.createdAt.toISOString(), r.kind, r.tool ?? '', r.summary, r.detail ?? '']
        .map(csvCell)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

/** Older rows go (the worker's daily sweep); 90 days is what the page promises. */
export async function pruneApiActivity(ctx: StoreContext, now = new Date()): Promise<number> {
  const rows = await ctx.tx
    .delete(apiActivity)
    .where(lt(apiActivity.createdAt, new Date(now.getTime() - API_ACTIVITY_DAYS * DAY)))
    .returning({ id: apiActivity.id })
  return rows.length
}

/* ---------- overview ---------- */

export type McpOverview = {
  store: { name: string; slug: string }
  settings: McpSettings
  /** Clients signed in right now (not revoked, sign-in not lapsed). */
  clients: number
  lastRequestAt: Date | null
  /** Which known tools have at least one live connection. */
  connected: Record<McpClientId, boolean>
}

export async function loadMcpOverview(ctx: StoreContext, now = new Date()): Promise<McpOverview> {
  const [settings, { clients, tokens }, [s]] = await Promise.all([
    loadMcpSettings(ctx),
    listApiGrants(ctx, now),
    ctx.tx
      .select({ name: store.name, slug: store.slug })
      .from(store)
      .where(eq(store.id, ctx.storeId)),
  ])
  const live = clients.filter((c) => c.status === 'active')
  const last = [...clients, ...tokens]
    .map((g) => g.lastUsedAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0)
  const has = (id: McpClientId) => live.some((c) => c.client === id)
  return {
    store: s ?? { name: '', slug: '' },
    settings,
    clients: live.length,
    lastRequestAt: last ? new Date(last) : null,
    connected: {
      claude: has('claude'),
      chatgpt: has('chatgpt'),
      cursor: has('cursor'),
      vscode: has('vscode'),
    },
  }
}

/* ---------- OAuth: clients ---------- */

/**
 * Redirect URIs a client may register: https, a loopback http address (desktop apps listening
 * on a local port), or an app's own scheme (`cursor://`, `vscode://`, RFC 8252). Never
 * script-carrying or local-file schemes.
 */
function isAllowedRedirectUri(uri: string): boolean {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.hash) return false
  const scheme = url.protocol.slice(0, -1).toLowerCase()
  if (scheme === 'https') return true
  if (scheme === 'http') return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    ['javascript', 'data', 'file', 'vbscript', 'blob', 'about', 'ftp', 'ws', 'wss'].includes(scheme)
  )
    return false
  return /^[a-z][a-z0-9+.-]*$/.test(scheme)
}

const OAuthRegisterSchema = z.object({
  client_name: z.string().trim().max(120).optional(),
  redirect_uris: z
    .array(z.string().max(2000))
    .min(1)
    .max(10)
    .refine((uris) => uris.every(isAllowedRedirectUri), 'A redirect URI is not allowed'),
  token_endpoint_auth_method: z
    .enum(['none', 'client_secret_post', 'client_secret_basic'])
    .default('none'),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
})

export type RegisteredClient = {
  client_id: string
  client_secret?: string
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic'
  grant_types: string[]
  response_types: string[]
  client_id_issued_at: number
}

/** RFC 7591 dynamic registration: how Claude, ChatGPT, Cursor and VS Code introduce themselves. */
export async function registerOAuthClient(
  db: Db,
  input: unknown,
  now = new Date(),
): Promise<RegisteredClient> {
  const req = OAuthRegisterSchema.parse(input)
  const clientId = newSecret(CLIENT_PREFIX)
  const secret = req.token_endpoint_auth_method === 'none' ? null : newSecret(CLIENT_SECRET_PREFIX)
  const name = req.client_name?.trim() || 'AI client'
  await db.insert(oauthClient).values({
    clientId,
    secretHash: secret ? hashSecret(secret) : null,
    name,
    redirectUris: req.redirect_uris,
    createdAt: now,
  })
  return {
    client_id: clientId,
    ...(secret ? { client_secret: secret } : {}),
    client_name: name,
    redirect_uris: req.redirect_uris,
    token_endpoint_auth_method: req.token_endpoint_auth_method,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_id_issued_at: Math.floor(now.getTime() / 1000),
  }
}

export type OAuthClientRow = typeof oauthClient.$inferSelect

export async function findOAuthClient(db: Db, clientId: string): Promise<OAuthClientRow | null> {
  const [row] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId))
  return row ?? null
}

const sameHash = (a: string, b: string): boolean => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** A confidential client must show its secret; a public client must not have one. */
export function clientAuthenticates(client: OAuthClientRow, secret: string | null): boolean {
  if (!client.secretHash) return true
  return secret !== null && sameHash(hashSecret(secret), client.secretHash)
}

/* ---------- OAuth: codes and tokens ---------- */

type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unsupported_grant_type'

/** The OAuth `error` value doubles as the CommerceError code, so callers read `err.code` as before. */
export class OAuthError extends CommerceError {
  declare readonly code: OAuthErrorCode

  constructor(code: OAuthErrorCode, message: string) {
    super(code, message)
  }
}

const AuthorizeSchema = z.object({
  clientId: z.string().min(1).max(200),
  redirectUri: z.string().min(1).max(2000),
  codeChallenge: z.string().min(43).max(128),
  scopes: ApiScopesSchema,
})

/** "Allow" on the consent page: a one-time code for the client to swap for tokens. */
export async function issueAuthCode(
  ctx: StoreContext,
  userId: string,
  input: z.input<typeof AuthorizeSchema>,
  now = new Date(),
): Promise<string> {
  const req = AuthorizeSchema.parse(input)
  const code = newSecret(CODE_PREFIX)
  await ctx.tx.insert(apiAuthCode).values({
    storeId: ctx.storeId,
    clientId: req.clientId,
    userId,
    scopes: req.scopes,
    codeHash: hashSecret(code),
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    expiresAt: new Date(now.getTime() + OAUTH_CODE_TTL_MS),
    createdAt: now,
  })
  return code
}

export type TokenResponse = {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

const scopeString = (scopes: ApiScopes): string =>
  Object.entries(scopes)
    .map(([area, access]) => `${area}:${access}`)
    .join(' ')

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge sent at sign-in. */
function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  const hashed = createHash('sha256').update(verifier).digest('base64url')
  return sameHash(hashed, challenge)
}

function newTokens(now: Date) {
  const access = newSecret(ACCESS_PREFIX)
  const refresh = newSecret(REFRESH_PREFIX)
  return {
    access,
    refresh,
    columns: {
      accessHash: hashSecret(access),
      accessExpiresAt: new Date(now.getTime() + OAUTH_ACCESS_TTL_MS),
      refreshHash: hashSecret(refresh),
      refreshExpiresAt: new Date(now.getTime() + OAUTH_REFRESH_TTL_MS),
    },
  }
}

/** grant_type=authorization_code: the code, once, from the same client and redirect, with PKCE. */
export async function exchangeAuthCode(
  db: Db,
  input: { code: string; clientId: string; redirectUri: string; codeVerifier: string },
  now = new Date(),
): Promise<TokenResponse> {
  const codeHash = hashSecret(input.code)
  const storeId = await apiAuthCodeStore(db, codeHash)
  if (!storeId) throw new OAuthError('invalid_grant', 'Unknown or expired code')
  const client = await findOAuthClient(db, input.clientId)
  if (!client) throw new OAuthError('invalid_client', 'Unknown client')
  return withStore(db, storeId, async (tx) => {
    const [row] = await tx.select().from(apiAuthCode).where(eq(apiAuthCode.codeHash, codeHash))
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime())
      throw new OAuthError('invalid_grant', 'Unknown or expired code')
    if (row.clientId !== input.clientId || row.redirectUri !== input.redirectUri)
      throw new OAuthError('invalid_grant', 'The code was issued to another client')
    if (!pkceMatches(input.codeVerifier, row.codeChallenge))
      throw new OAuthError('invalid_grant', 'PKCE check failed')
    // Used once, even when something below fails.
    await tx.update(apiAuthCode).set({ usedAt: now }).where(eq(apiAuthCode.id, row.id))
    const scopes = row.scopes as ApiScopes
    const t = newTokens(now)
    const [grant] = await tx
      .insert(apiGrant)
      .values({
        storeId,
        kind: 'oauth',
        name: client.name,
        clientId: client.clientId,
        userId: row.userId,
        scopes,
        hint: hintOf(t.access),
        ...t.columns,
        createdAt: now,
      })
      .returning({ id: apiGrant.id })
    await recordApiActivity(tx, storeId, {
      grantId: grant?.id ?? null,
      kind: 'connected',
      summary: `${client.name} connected`,
      detail: `${await memberName(tx, row.userId)} signed in · can use ${areaList(scopes)}`,
      at: now,
    })
    return {
      access_token: t.access,
      token_type: 'Bearer',
      expires_in: OAUTH_ACCESS_TTL_MS / 1000,
      refresh_token: t.refresh,
      scope: scopeString(scopes),
    }
  })
}

/** grant_type=refresh_token: both tokens rotate; the old refresh token stops working. */
export async function refreshOAuthToken(
  db: Db,
  input: { refreshToken: string; clientId: string },
  now = new Date(),
): Promise<TokenResponse> {
  const found = await apiGrantForRefresh(db, hashSecret(input.refreshToken))
  if (!found) throw new OAuthError('invalid_grant', 'Unknown refresh token')
  return withStore(db, found.storeId, async (tx) => {
    const [row] = await tx.select().from(apiGrant).where(eq(apiGrant.id, found.grantId))
    if (!row || row.revokedAt || row.clientId !== input.clientId)
      throw new OAuthError('invalid_grant', 'Unknown refresh token')
    if (!row.refreshExpiresAt || row.refreshExpiresAt.getTime() <= now.getTime())
      throw new OAuthError('invalid_grant', 'The sign-in lapsed; connect again')
    const t = newTokens(now)
    await tx.update(apiGrant).set(t.columns).where(eq(apiGrant.id, row.id))
    return {
      access_token: t.access,
      token_type: 'Bearer',
      expires_in: OAUTH_ACCESS_TTL_MS / 1000,
      refresh_token: t.refresh,
      scope: scopeString(row.scopes as ApiScopes),
    }
  })
}

/** RFC 7009: a client signing out revokes its own grant. Unknown tokens are not an error. */
export async function revokeOAuthToken(db: Db, token: string, now = new Date()): Promise<void> {
  const hash = hashSecret(token)
  const found = (await apiGrantForAccess(db, hash)) ?? (await apiGrantForRefresh(db, hash))
  if (!found) return
  await withStore(db, found.storeId, async (tx) => {
    const [row] = await tx
      .update(apiGrant)
      .set({ revokedAt: now })
      .where(and(eq(apiGrant.id, found.grantId), isNull(apiGrant.revokedAt)))
      .returning()
    if (row)
      await recordApiActivity(tx, found.storeId, {
        grantId: row.id,
        kind: 'revoked',
        summary: `${row.name} signed out`,
        at: now,
      })
  })
}

/* ---------- authenticating a call ---------- */

/** Who a bearer token acts for, and exactly what it may do. */
export type ApiPrincipal = {
  grantId: string
  kind: ApiGrantKind
  /** The client's or token's name, for the activity log ("Claude read 24 orders"). */
  name: string
  storeId: string
  storeSlug: string
  organizationId: string
  userId: string
  email: string
  userName: string
  scopes: ApiScopes
  /** The member's role ∩ the grant's areas. */
  permissions: Permission[]
}

export type ApiAuthResult =
  | { ok: true; principal: ApiPrincipal }
  | { ok: false; reason: 'invalid' | 'expired' }

/** Don't write `last_used_at` on every call: once a minute is plenty for "4 min ago". */
const TOUCH_EVERY_MS = 60_000

/**
 * A bearer token → the member and permissions it carries, read fresh every call: a revoked
 * grant, a removed member or a narrowed role applies on the very next request.
 */
export async function authenticateApiToken(
  db: Db,
  token: string,
  opts: { ip?: string | null | undefined; now?: Date | undefined } = {},
): Promise<ApiAuthResult> {
  const now = opts.now ?? new Date()
  if (!token.startsWith(TOKEN_PREFIX) && !token.startsWith(ACCESS_PREFIX))
    return { ok: false, reason: 'invalid' }
  const found = await apiGrantForAccess(db, hashSecret(token))
  if (!found) return { ok: false, reason: 'invalid' }
  return withStore(db, found.storeId, async (tx): Promise<ApiAuthResult> => {
    const [row] = await tx.select().from(apiGrant).where(eq(apiGrant.id, found.grantId))
    if (!row || row.revokedAt) return { ok: false, reason: 'invalid' }
    if (row.accessExpiresAt && row.accessExpiresAt.getTime() <= now.getTime()) {
      if (row.kind === 'token') await noteExpired(tx, row, now)
      return { ok: false, reason: 'expired' }
    }
    const principal = await principalOf(tx, found.storeId, row)
    if (!principal) return { ok: false, reason: 'invalid' }
    if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      await tx
        .update(apiGrant)
        .set({ lastUsedAt: now, lastIp: maskApiIp(opts.ip) ?? row.lastIp })
        .where(eq(apiGrant.id, row.id))
    }
    return { ok: true, principal }
  })
}

/**
 * A grant still in force, by id: an MCP download link carries the grant, not the token, so
 * the file is fetched as the same member with the same areas, read fresh.
 */
export async function principalForGrant(
  db: Db,
  storeId: string,
  grantId: string,
  now = new Date(),
): Promise<ApiPrincipal | null> {
  return withStore(db, storeId, async (tx) => {
    const [row] = await tx.select().from(apiGrant).where(eq(apiGrant.id, grantId))
    if (!row || row.revokedAt) return null
    const lapsed = row.kind === 'token' ? row.accessExpiresAt : row.refreshExpiresAt
    if (lapsed && lapsed.getTime() <= now.getTime()) return null
    return principalOf(tx, storeId, row)
  })
}

/** Who a grant acts for: its member (still on the team), their role ∩ the grant's areas. */
async function principalOf(
  tx: StoreTx,
  storeId: string,
  row: GrantRow,
): Promise<ApiPrincipal | null> {
  const access = await memberAccess(tx, storeId, row.userId)
  if (!access) return null
  const [who] = await tx
    .select({ email: authSchema.user.email, name: authSchema.user.name })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, row.userId))
  const [s] = await tx
    .select({ slug: store.slug, organizationId: store.organizationId })
    .from(store)
    .where(eq(store.id, storeId))
  if (!who || !s?.organizationId) return null
  const scopes = row.scopes as ApiScopes
  const held = new Set<Permission>(access.isOwner ? ALL_PERMISSIONS : access.permissions)
  return {
    grantId: row.id,
    kind: row.kind,
    name: row.name,
    storeId,
    storeSlug: s.slug,
    organizationId: s.organizationId,
    userId: row.userId,
    email: who.email,
    userName: who.name,
    scopes,
    permissions: permissionsForScopes(scopes).filter((perm) => held.has(perm)),
  }
}

/** The first refused call after a token's expiry leaves one "token expired" row. */
async function noteExpired(tx: StoreTx, row: GrantRow, now: Date): Promise<void> {
  const [seen] = await tx
    .select({ id: apiActivity.id })
    .from(apiActivity)
    .where(and(eq(apiActivity.grantId, row.id), eq(apiActivity.kind, 'expired')))
    .limit(1)
  if (seen) return
  await recordApiActivity(tx, row.storeId, {
    grantId: row.id,
    kind: 'expired',
    summary: `${row.name} token expired`,
    detail: `Created by ${await memberName(tx, row.userId)}`,
    at: now,
  })
}
