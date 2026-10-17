import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * Settings → MCP & API: AI clients (Claude, ChatGPT, Cursor, VS Code) that sign in over OAuth,
 * and access tokens for scripts. Both act for one member of one store, never more than that
 * member's role allows, and only in the areas the grant names. Tokens, refresh tokens and
 * sign-in codes are stored as SHA-256 hashes; the plain values are shown once and never kept.
 */

/** Area → `read` or `write`. The areas and what each unlocks live in `@commerce/core/api-access`. */
export type ApiScopes = Record<string, 'read' | 'write'>

/** `oauth`: an AI client that signed in. `token`: an access token made for a script. */
export const API_GRANT_KINDS = ['oauth', 'token'] as const
export type ApiGrantKind = (typeof API_GRANT_KINDS)[number]

/**
 * What the activity log records. `read` and `change` are tool and API calls; `approval` is a
 * change that waits in AI approvals; `blocked` is a call a setting or a scope refused.
 */
export const API_ACTIVITY_KINDS = [
  'read',
  'change',
  'approval',
  'blocked',
  'connected',
  'revoked',
  'expired',
] as const
export type ApiActivityKind = (typeof API_ACTIVITY_KINDS)[number]

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const at = (name: string) => timestamp(name, { withTimezone: true })

/**
 * An OAuth client that registered itself (RFC 7591). Platform-wide: a client registers before
 * anyone signs in, so it belongs to no store; what it may do is decided per store by `api_grant`.
 */
export const oauthClient = pgTable('oauth_client', {
  id: id(),
  clientId: text('client_id').notNull().unique(),
  /** Hash of the client secret, for clients that asked for one; null for public (PKCE) clients. */
  secretHash: text('secret_hash'),
  name: text('name').notNull(),
  redirectUris: text('redirect_uris').array().notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
})

export const apiGrant = pgTable(
  'api_grant',
  {
    id: id(),
    storeId: storeId(),
    kind: text('kind').$type<ApiGrantKind>().notNull(),
    /** The client's name ("Claude") or the token's ("Inventory sync script"). */
    name: text('name').notNull(),
    /** The OAuth client; null for tokens. */
    clientId: text('client_id'),
    /** The member it acts for; their role still caps it. */
    userId: text('user_id').notNull(),
    scopes: jsonb('scopes').$type<ApiScopes>().notNull(),
    /** What the list shows instead of the secret: `kmc_…7Q2f`. */
    hint: text('hint').notNull(),
    accessHash: text('access_hash').notNull(),
    /** When the current access token stops working; null for a token that never expires. */
    accessExpiresAt: at('access_expires_at'),
    refreshHash: text('refresh_hash'),
    refreshExpiresAt: at('refresh_expires_at'),
    lastUsedAt: at('last_used_at'),
    /** The caller's address with the last two parts hidden (`13.233.x.x`). */
    lastIp: text('last_ip'),
    revokedAt: at('revoked_at'),
    revokedBy: text('revoked_by'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('api_grant_access').on(t.accessHash),
    uniqueIndex('api_grant_refresh').on(t.refreshHash),
    index('api_grant_store').on(t.storeId, t.createdAt),
    check('api_grant_kind', sql`${t.kind} in ('oauth','token')`),
  ],
)

/** A one-time OAuth sign-in code (PKCE), good for a few minutes. */
export const apiAuthCode = pgTable(
  'api_auth_code',
  {
    id: id(),
    storeId: storeId(),
    clientId: text('client_id').notNull(),
    userId: text('user_id').notNull(),
    scopes: jsonb('scopes').$type<ApiScopes>().notNull(),
    codeHash: text('code_hash').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    expiresAt: at('expires_at').notNull(),
    usedAt: at('used_at'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('api_auth_code_hash').on(t.codeHash)],
)

export const apiActivity = pgTable(
  'api_activity',
  {
    id: id(),
    storeId: storeId(),
    grantId: uuid('grant_id').references(() => apiGrant.id),
    kind: text('kind').$type<ApiActivityKind>().notNull(),
    /** The tool or procedure, e.g. `findProducts` or `inventory.adjust`. */
    tool: text('tool'),
    /** One plain line: "Claude read 24 orders". */
    summary: text('summary').notNull(),
    detail: text('detail'),
    /** The AI approval a change waits in, for "Open approval". */
    aiActionId: uuid('ai_action_id'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('api_activity_store').on(t.storeId, t.createdAt),
    check(
      'api_activity_kind',
      sql`${t.kind} in ('read','change','approval','blocked','connected','revoked','expired')`,
    ),
  ],
)
