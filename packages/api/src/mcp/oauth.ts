/**
 * OAuth 2.1 for MCP clients, the HTTP side (the rules live in `@commerce/core` api-access):
 * discovery metadata (RFC 8414, RFC 9728), dynamic registration (RFC 7591), the token and
 * revocation endpoints, and the checks behind the admin's consent page (`/oauth/authorize`).
 * The admin app's route handlers only call these.
 */
import { siteConfig } from '@commerce/config/site'
import {
  API_AREAS,
  type ApiScopes,
  checkRateLimit,
  clientAuthenticates,
  createMemoryRateLimitStore,
  exchangeAuthCode,
  findOAuthClient,
  issueAuthCode,
  memberAccess,
  type OAuthClientRow,
  OAuthError,
  type RateLimitStore,
  rateLimitKey,
  refreshOAuthToken,
  registerOAuthClient,
  revokeOAuthToken,
} from '@commerce/core'
import { type Db, resolveStoreForOrganization, storeIdForSlug, withStore } from '@commerce/db'
import { ZodError } from 'zod'
import { storeNameAndSlug } from '../services/mcp.service'
import { clientIp, mcpPath } from './server'

const fallback = createMemoryRateLimitStore()

/** Browsers (the MCP inspector, web clients) call these cross-origin; no cookies are involved. */
export const OAUTH_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
  'access-control-expose-headers': 'www-authenticate',
} as const

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...OAUTH_CORS },
  })

const oauthFail = (error: string, description: string, status = 400) =>
  json({ error, error_description: description }, status)

/** RFC 8414 `/.well-known/oauth-authorization-server`. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: API_AREAS.flatMap((a) => [`${a}:read`, `${a}:write`]),
  }
}

/** RFC 9728 `/.well-known/oauth-protected-resource/api/mcp/<slug>`. */
export function protectedResourceMetadata(origin: string, slug: string) {
  return {
    resource: `${origin}${mcpPath(slug)}`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    resource_name: `${siteConfig.brand.name} MCP`,
  }
}

/** POST `/api/oauth/register`. At most 20 registrations an hour per address. */
export async function handleRegister(
  request: Request,
  host: { db: Db; rateLimit?: RateLimitStore | undefined },
): Promise<Response> {
  const limit = await checkRateLimit(
    host.rateLimit ?? fallback,
    rateLimitKey('oauth-register', clientIp(request) ?? 'unknown'),
    { limit: 20, windowMs: 60 * 60_000 },
  )
  if (!limit.ok) return oauthFail('slow_down', 'Too many registrations. Try again later.', 429)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return oauthFail('invalid_client_metadata', 'The body must be JSON')
  }
  try {
    return json(await registerOAuthClient(host.db, body), 201)
  } catch (err) {
    if (err instanceof ZodError)
      return oauthFail(
        err.issues.some((i) => i.path[0] === 'redirect_uris')
          ? 'invalid_redirect_uri'
          : 'invalid_client_metadata',
        err.issues.map((i) => i.message).join('. '),
      )
    throw err
  }
}

/** The form fields, from a form post or a JSON body. */
async function formOf(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === 'string') as [string, string][],
    )
  }
  const form = new URLSearchParams(await request.text())
  return Object.fromEntries(form.entries())
}

/** HTTP Basic client credentials, when the client uses them. */
function basicCredentials(request: Request): { id: string; secret: string } | null {
  const m = (request.headers.get('authorization') ?? '').match(/^Basic\s+(\S+)$/i)
  if (!m?.[1]) return null
  const decoded = Buffer.from(m[1], 'base64').toString('utf8')
  const at = decoded.indexOf(':')
  if (at < 0) return null
  return {
    id: decodeURIComponent(decoded.slice(0, at)),
    secret: decodeURIComponent(decoded.slice(at + 1)),
  }
}

/** POST `/api/oauth/token`: authorization_code and refresh_token. */
export async function handleToken(request: Request, host: { db: Db }): Promise<Response> {
  const form = await formOf(request)
  const basic = basicCredentials(request)
  const clientId = basic?.id ?? form.client_id ?? ''
  const secret = basic?.secret ?? form.client_secret ?? null
  const client = clientId ? await findOAuthClient(host.db, clientId) : null
  if (!client || !clientAuthenticates(client, secret))
    return oauthFail('invalid_client', 'Unknown client or wrong secret', 401)
  try {
    if (form.grant_type === 'authorization_code') {
      if (!form.code || !form.redirect_uri || !form.code_verifier)
        return oauthFail('invalid_request', 'code, redirect_uri and code_verifier are required')
      return json(
        await exchangeAuthCode(host.db, {
          code: form.code,
          clientId,
          redirectUri: form.redirect_uri,
          codeVerifier: form.code_verifier,
        }),
      )
    }
    if (form.grant_type === 'refresh_token') {
      if (!form.refresh_token) return oauthFail('invalid_request', 'refresh_token is required')
      return json(await refreshOAuthToken(host.db, { refreshToken: form.refresh_token, clientId }))
    }
    return oauthFail('unsupported_grant_type', 'Use authorization_code or refresh_token')
  } catch (err) {
    if (err instanceof OAuthError) return oauthFail(err.code, err.message)
    throw err
  }
}

/** POST `/api/oauth/revoke` (RFC 7009): always 200, so it says nothing about the token. */
export async function handleRevoke(request: Request, host: { db: Db }): Promise<Response> {
  const form = await formOf(request)
  if (form.token) await revokeOAuthToken(host.db, form.token)
  return new Response(null, { status: 200, headers: OAUTH_CORS })
}

/* ---------- the consent page ---------- */

export type AuthorizeParams = {
  response_type?: string | undefined
  client_id?: string | undefined
  redirect_uri?: string | undefined
  code_challenge?: string | undefined
  code_challenge_method?: string | undefined
  state?: string | undefined
  resource?: string | undefined
  scope?: string | undefined
}

export type AuthorizeRequest = {
  client: Pick<OAuthClientRow, 'clientId' | 'name'>
  redirectUri: string
  codeChallenge: string
  state: string | null
  /** The store the MCP address names; null when the client sent no `resource`. */
  slug: string | null
  /** Areas the client asked for (`products:write …`); empty when it asked for none. */
  requested: ApiScopes
}

export type AuthorizeCheck =
  /** Show the consent page. */
  | { ok: true; request: AuthorizeRequest }
  /** Never redirect: the client or its redirect address is not trusted. */
  | { ok: false; redirect: null; message: string }
  /** Send the browser back to the client with an OAuth error. */
  | { ok: false; redirect: string; message: string }

/** `?error=…&state=…` on the client's own redirect address. */
export function redirectWith(uri: string, params: Record<string, string | null>): string {
  const url = new URL(uri)
  for (const [k, v] of Object.entries(params)) if (v !== null) url.searchParams.set(k, v)
  return url.toString()
}

const slugOfResource = (resource: string | undefined, origin: string): string | null => {
  if (!resource) return null
  try {
    const url = new URL(resource)
    const prefix = `${new URL(origin).pathname.replace(/\/$/, '')}/api/mcp/`
    if (url.origin !== new URL(origin).origin || !url.pathname.startsWith(prefix)) return null
    const slug = url.pathname.slice(prefix.length).split('/')[0]
    return slug ? slug.toLowerCase() : null
  } catch {
    return null
  }
}

function requestedScopes(scope: string | undefined): ApiScopes {
  const out: ApiScopes = {}
  for (const part of (scope ?? '').split(/\s+/)) {
    const [area, access] = part.split(':')
    if (!(API_AREAS as readonly string[]).includes(area ?? '')) continue
    const key = area as (typeof API_AREAS)[number]
    if (access === 'write') out[key] = 'write'
    else if (access === 'read' && out[key] !== 'write') out[key] = 'read'
  }
  return out
}

/** Checks a sign-in request before the consent page shows it. */
export async function checkAuthorize(
  db: Db,
  origin: string,
  params: AuthorizeParams,
): Promise<AuthorizeCheck> {
  const client = params.client_id ? await findOAuthClient(db, params.client_id) : null
  if (!client) return { ok: false, redirect: null, message: 'This app is not registered.' }
  const redirectUri = params.redirect_uri ?? client.redirectUris[0]
  if (!redirectUri || !client.redirectUris.includes(redirectUri))
    return { ok: false, redirect: null, message: 'This app sent an unknown return address.' }
  const state = params.state ?? null
  const back = (error: string, description: string) => ({
    ok: false as const,
    redirect: redirectWith(redirectUri, { error, error_description: description, state }),
    message: description,
  })
  if (params.response_type !== 'code')
    return back('unsupported_response_type', 'Use response_type=code')
  if (!params.code_challenge || params.code_challenge_method !== 'S256')
    return back('invalid_request', 'PKCE with S256 is required')
  const slug = slugOfResource(params.resource, origin)
  if (params.resource && !slug) return back('invalid_target', 'Unknown resource')
  return {
    ok: true,
    request: {
      client: { clientId: client.clientId, name: client.name },
      redirectUri,
      codeChallenge: params.code_challenge,
      state,
      slug,
      requested: requestedScopes(params.scope),
    },
  }
}

/**
 * The store a consent page signs into, if the member belongs to it: the one the MCP address
 * names, or (a client that sent no `resource`) the member's current store.
 */
export async function consentStore(
  db: Db,
  target: { slug: string | null; organizationId: string | null },
  userId: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  const storeId = target.slug
    ? await storeIdForSlug(db, target.slug)
    : target.organizationId
      ? await resolveStoreForOrganization(db, target.organizationId)
      : null
  if (!storeId) return null
  return withStore(db, storeId, async (tx) => {
    if (!(await memberAccess(tx, storeId, userId))) return null
    const row = await storeNameAndSlug(tx, storeId)
    return row ? { id: storeId, ...row } : null
  })
}

/**
 * "Allow" on the consent page: re-checks the request and the membership, then returns the
 * client's redirect address with a one-time code. "Deny" returns it with access_denied.
 */
export async function decideAuthorize(
  db: Db,
  origin: string,
  input: {
    params: AuthorizeParams
    userId: string
    slug: string
    scopes: ApiScopes
    allow: boolean
  },
): Promise<string> {
  const check = await checkAuthorize(db, origin, input.params)
  if (!check.ok) {
    if (check.redirect) return check.redirect
    throw new OAuthError('invalid_request', check.message)
  }
  const r = check.request
  if (!input.allow) return redirectWith(r.redirectUri, { error: 'access_denied', state: r.state })
  const target = await consentStore(
    db,
    { slug: r.slug ?? input.slug, organizationId: null },
    input.userId,
  )
  if (!target) throw new OAuthError('invalid_request', 'You are not a member of that store')
  const code = await withStore(db, target.id, (tx) =>
    issueAuthCode({ tx, storeId: target.id }, input.userId, {
      clientId: r.client.clientId,
      redirectUri: r.redirectUri,
      codeChallenge: r.codeChallenge,
      scopes: input.scopes,
    }),
  )
  return redirectWith(r.redirectUri, { code, state: r.state, iss: origin })
}
