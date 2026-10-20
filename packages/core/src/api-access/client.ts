/** SOURCE OF TRUTH: MCP & API areas and limits — WHAT: grant areas, permissions they unlock, AI client switches / WHY: client-safe for the admin */
/**
 * Settings → MCP & API: the areas a client or token can reach and the permissions each one
 * unlocks, the "What AI clients can do" switches, and the limits. Pure and client-safe, so
 * admin components import it through `@commerce/core/api-access`.
 */
import { z } from 'zod'
import { type Permission, permissions as p } from '../permissions/statement'

export const API_AREAS = [
  'products',
  'orders',
  'customers',
  'inventory',
  'discounts',
  'content',
  'analytics',
] as const
export type ApiArea = (typeof API_AREAS)[number]
export type ApiAccess = 'read' | 'write'
export type ApiScopes = Partial<Record<ApiArea, ApiAccess>>

export const isApiArea = (v: unknown): v is ApiArea =>
  typeof v === 'string' && (API_AREAS as readonly string[]).includes(v)

/**
 * What each area unlocks. Write never reaches money or deletion: no refunds, cancellations,
 * product or customer deletes, and nothing in settings, staff or billing.
 */
const AREA_PERMISSIONS: Record<ApiArea, Record<ApiAccess, Permission[]>> = {
  products: { read: [p.PRODUCTS_READ], write: [p.PRODUCTS_WRITE] },
  orders: {
    read: [p.ORDERS_READ, p.DRAFTS_READ],
    write: [p.ORDERS_WRITE, p.ORDERS_FULFIL, p.DRAFTS_WRITE],
  },
  customers: { read: [p.CUSTOMERS_READ], write: [p.CUSTOMERS_WRITE] },
  inventory: { read: [p.INVENTORY_READ], write: [p.INVENTORY_WRITE] },
  discounts: { read: [p.DISCOUNTS_READ], write: [p.DISCOUNTS_WRITE] },
  content: { read: [p.CONTENT_READ], write: [p.CONTENT_WRITE] },
  analytics: { read: [p.ANALYTICS_READ], write: [] },
}

/** Areas with nothing to write: the Write box is off and disabled. */
export const READ_ONLY_AREAS: readonly ApiArea[] = API_AREAS.filter(
  (a) => AREA_PERMISSIONS[a].write.length === 0,
)

export const ApiScopesSchema = z
  .partialRecord(z.enum(API_AREAS), z.enum(['read', 'write']))
  .refine((s) => Object.keys(s).length > 0, 'Pick at least one area')

/** Every permission a set of scopes allows. Write includes read. */
export function permissionsForScopes(scopes: ApiScopes): Permission[] {
  const out = new Set<Permission>()
  for (const area of API_AREAS) {
    const access = scopes[area]
    if (!access) continue
    for (const perm of AREA_PERMISSIONS[area].read) out.add(perm)
    if (access === 'write') for (const perm of AREA_PERMISSIONS[area].write) out.add(perm)
  }
  return [...out]
}

/** The areas a grant reads and the ones it may also change, in display order. */
export function scopeParts(scopes: ApiScopes): { reads: ApiArea[]; writes: ApiArea[] } {
  const reads = API_AREAS.filter((a) => scopes[a])
  return { reads, writes: reads.filter((a) => scopes[a] === 'write') }
}

/** What the consent page ticks first: read everything, change products, discounts, content. */
export const DEFAULT_CLIENT_SCOPES: ApiScopes = {
  products: 'write',
  orders: 'read',
  customers: 'read',
  inventory: 'read',
  discounts: 'write',
  content: 'write',
  analytics: 'read',
}

/** Figma "What AI clients can do". Stored on `store.preferences.mcp`. */
export const McpSettingsSchema = z.object({
  /** Off: clients can only read. */
  allowChanges: z.boolean().catch(true),
  /** On: every change waits in AI approvals. Off: a change runs as soon as the client asks. */
  requireApproval: z.boolean().catch(true),
  /** Names, phone numbers and addresses. Off: orders still show the city. */
  readCustomers: z.boolean().catch(false),
})
export type McpSettings = z.infer<typeof McpSettingsSchema>

export const defaultMcpSettings: McpSettings = McpSettingsSchema.parse({})

/** `store.preferences.mcp`, with defaults for anything missing or broken. */
export function parseMcpSettings(preferences: unknown): McpSettings {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as Record<string, unknown>).mcp
      : undefined
  const r = McpSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultMcpSettings
}

/** Token lifetimes in days the Create token dialog offers; null = never expires. */
export const TOKEN_EXPIRY_DAYS = [30, 90, 365, null] as const
export type TokenExpiryDays = (typeof TOKEN_EXPIRY_DAYS)[number]

export const CreateTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: ApiScopesSchema,
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]),
})
export type CreateTokenInput = z.infer<typeof CreateTokenSchema>

/** Requests per minute per client or token, so one tool cannot slow the store. */
export const API_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const

/** How long the activity log keeps rows. */
export const API_ACTIVITY_DAYS = 90

/** The activity filters (Figma "All · Reads · Changes · Waiting approval · Blocked"). */
export const API_ACTIVITY_FILTERS = ['all', 'read', 'change', 'approval', 'blocked'] as const
export type ApiActivityFilter = (typeof API_ACTIVITY_FILTERS)[number]

/** The AI tools a client sign-in page names, with the brand each guide opens. */
export const MCP_CLIENTS = ['claude', 'chatgpt', 'cursor', 'vscode'] as const
export type McpClientId = (typeof MCP_CLIENTS)[number]

/** Which known tool a registered OAuth client is, from the name it registered with. */
export function mcpClientOf(name: string): McpClientId | null {
  const n = name.toLowerCase()
  if (n.includes('claude')) return 'claude'
  if (n.includes('chatgpt') || n.includes('openai')) return 'chatgpt'
  if (n.includes('cursor')) return 'cursor'
  if (n.includes('visual studio') || n.includes('vs code') || n.includes('vscode')) return 'vscode'
  return null
}
