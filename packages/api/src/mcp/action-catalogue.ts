/**
 * Every admin procedure an MCP client may reach through `searchActions` / `describeAction` /
 * `runAction`, and how each one is treated:
 *
 *   read       runs at once
 *   write      follows Settings → MCP & API → "Changes need approval"
 *   sensitive  always waits in AI approvals and runs as the member who approves it
 *   excluded   never listed, never run (sign-in and sessions, tokens, platform and cross-store)
 *
 * The explicit tables below win; otherwise a name that starts with a read verb is a read, a
 * name that starts with delete/remove/cancel/refund… is sensitive, and the rest are writes.
 * Each router namespace maps to the grant area (`@commerce/core/api-access`) a client must
 * hold: read for reads, write for anything else. The catalogue itself is walked from the live
 * router (`buildCatalogue`), so a new procedure appears without editing this file.
 */
import type { ApiArea } from '@commerce/core/api-access'
import { type AnyProcedure, isProcedure } from '@orpc/server'
import { ACTION_DOCS } from './action-docs.generated'

export type ActionKind = 'read' | 'write' | 'sensitive'

const READ_PREFIXES = [
  'list',
  'get',
  'find',
  'search',
  'count',
  'summary',
  'stats',
  'preview',
  'quote',
  'check',
  'status',
]

/** Names that only read but do not start with a read verb. */
const READ_NAMES = new Set([
  'abandonedStats',
  'action',
  'activity',
  'activityCsv',
  'adjustments',
  'analytics',
  'apps',
  'assignments',
  'audience',
  'audit',
  'autopay',
  'backgroundWork',
  'bigSaleDays',
  'blogs',
  'bulkJob',
  'bulkJobs',
  'charts',
  'connection',
  'consent',
  'controls',
  'costs',
  'counts',
  'couriers',
  'current',
  'customer',
  'defaults',
  'definition',
  'definitions',
  'download',
  'downloadExport',
  'draftTiles',
  'entries',
  'entry',
  'estimateDelivery',
  'experiments',
  'export',
  'exportCsv',
  'exportRows',
  'facets',
  'feed',
  'files',
  'forCustomer',
  'forOrder',
  'forProduct',
  'grants',
  'gstNumbers',
  'gstr1',
  'history',
  'ids',
  'indiaPostLabel',
  'issueGroups',
  'issues',
  'label',
  'live',
  'locations',
  'loopSources',
  'loopValues',
  'lookupPincode',
  'me',
  'members',
  'metafieldDefinitions',
  'metafields',
  'neighbours',
  'order',
  'orderActions',
  'origin',
  'overview',
  'pdf',
  'pick',
  'policy',
  'product',
  'profit',
  'properties',
  'query',
  'readiness',
  'readyToShip',
  'recent',
  'references',
  'report',
  'reports',
  'requests',
  'resolveOrderNumbers',
  'review',
  'roles',
  'rtoSummary',
  'savedReports',
  'segment',
  'segments',
  'sendableChannels',
  'seriesNext',
  'settings',
  'settingsPreview',
  'setupChecklist',
  'sheet',
  'sitemaps',
  'snapshot',
  'sourceValues',
  'sources',
  'storageMigrationStatus',
  'tags',
  'template',
  'tiles',
  'toShipCount',
  'totals',
  'usage',
  'version',
  'versions',
  'view',
  'wallets',
  'whatsappTemplates',
])

/** Reads whose name says otherwise. */
const READ_PATHS = new Set([
  'payments.setup',
  'payments.testMode',
  'gstInvoices.bulkDownload',
  'apps.testConnection',
  'collections.products',
  'giftCards.products',
  'reviews.products',
  'marketing.emailBrand',
  'marketing.setup',
  'automations.catalogue',
  'automations.templates',
  'automations.testRun',
  'notifications.senderEmail',
  'salesChannels.social',
  'shopifyImport.preflight',
  'shopifyImport.run',
  'shopifyImport.runs',
  'staff.invitations',
  'themes.code.read',
  'themes.import.render',
  'themes.logo',
  'themes.packs',
])

/** Whole namespaces no client may see: people's own sign-in, store picking, the platform. */
const EXCLUDED_NAMESPACES: Record<string, string> = {
  account: "the member's own sign-in, sessions and account deletion",
  me: "the member's own session",
  onboarding: 'creating a new store (cross-store)',
  invitations: 'accepting an invitation to another store (cross-store)',
  bugReports: 'files issues with the platform team (internal)',
}

/** Single procedures no client may see. */
const EXCLUDED_PATHS: Record<string, string> = {
  'apiAccess.createToken': 'creates an access token',
  'apiAccess.revoke': 'revokes MCP clients and access tokens',
  'ai.approveAction': 'a client must never approve its own proposals',
  'ai.reviseAction': 'edits a waiting proposal (people only)',
  'ai.cancelAction': 'cancels a waiting proposal (people only)',
  'automations.approvals.decide': 'approves an automation step (people only)',
  'ai.undoAction': 'undoes an approved AI change (people only)',
  'ai.assistant': 'the admin AI bar itself (a streamed model answer)',
  'payments.razorpayOAuthStart': 'a browser sign-in hand-off to Razorpay',
  'payments.razorpayOAuthComplete': 'a browser sign-in hand-off to Razorpay',
  'searchConsole.connectStart': 'a browser sign-in hand-off to Google',
  'searchConsole.connectComplete': 'a browser sign-in hand-off to Google',
  'media.presign': 'a browser upload hand-off',
  'media.confirm': 'a browser upload hand-off',
}

/** Namespaces where every change is sensitive: money, keys, people, the store itself. */
const SENSITIVE_NAMESPACES: Record<string, string> = {
  payments: 'payment gateway keys and settings',
  staff: 'staff, roles and permissions',
  billing: 'billing and plan',
  domains: 'domains',
  storeData: 'store export, deletion and transfer',
  apiAccess: 'MCP & API settings',
}

/** Name prefixes that delete, cancel or move money. */
const SENSITIVE_PREFIXES = [
  'delete',
  'remove',
  'uninstall',
  'anonymise',
  'cancel',
  'refund',
  'disconnect',
  'revoke',
]

const SENSITIVE_PATHS: Record<string, string> = {
  'returns.storeCredit': 'issues store credit (money)',
  'giftCards.issue': 'issues a gift card (money)',
  'giftCards.adjust': 'changes a gift card balance (money)',
  'giftCards.setDisabled': 'disables a gift card (money)',
  'orders.collectPayment': 'records money collected',
  'store.updatePayments': 'payment settings',
  'store.updateStorage': 'storage keys',
  'store.migrateStorage': 'moves every file to new storage',
  'marketing.campaigns.schedule': 'sends a campaign to customers',
  'automations.publish': 'a standing order to change the store',
  'automations.setStatus': 'switches a workflow on or off',
  'automations.runNow': 'runs a workflow on records now',
  'automations.runs.retry': 'runs a workflow step again',
}

/** Writes that turn sensitive for some inputs. */
const SENSITIVE_WHEN: Record<string, { note: string; when: (input: unknown) => boolean }> = {
  'orders.setStatus': {
    note: 'cancelling an order',
    when: (input) => field(input, 'status') === 'cancelled',
  },
  'products.bulk': {
    note: 'deleting products',
    when: (input) => field(field(input, 'action'), 'kind') === 'delete',
  },
}

const NAMESPACE_AREA: Record<string, ApiArea> = {
  products: 'products',
  collections: 'products',
  reviews: 'products',
  orders: 'orders',
  returns: 'orders',
  shipments: 'orders',
  gstInvoices: 'orders',
  customers: 'customers',
  customerPrivacy: 'customers',
  forms: 'customers',
  inventory: 'inventory',
  purchaseOrders: 'inventory',
  transfers: 'inventory',
  suppliers: 'inventory',
  inboundShipments: 'inventory',
  purchaseCharges: 'inventory',
  purchaseDocuments: 'inventory',
  discounts: 'discounts',
  giftCards: 'discounts',
  metaobjects: 'content',
  media: 'content',
  analytics: 'analytics',
  dashboard: 'analytics',
  activity: 'analytics',
  seo: 'analytics',
  marketing: 'marketing',
  automations: 'settings',
  backInStock: 'marketing',
  shortLinks: 'marketing',
  salesChannels: 'marketing',
  themes: 'online_store',
  pages: 'online_store',
  blog: 'online_store',
  navigation: 'online_store',
  redirects: 'online_store',
  policies: 'online_store',
  search: 'online_store',
  store: 'settings',
  storeData: 'settings',
  appearance: 'settings',
  apiAccess: 'settings',
  billing: 'settings',
  shipping: 'settings',
  payments: 'settings',
  checkoutSettings: 'settings',
  customerAccounts: 'settings',
  notifications: 'settings',
  apps: 'settings',
  taxes: 'settings',
  businessGst: 'settings',
  profitCosts: 'settings',
  shopifyImport: 'settings',
  emi: 'settings',
  umami: 'settings',
  chatwoot: 'settings',
  growthbook: 'settings',
  searchConsole: 'settings',
  meilisearch: 'settings',
  ai: 'settings',
  staff: 'settings',
  domains: 'settings',
}

/** AI features that work on products rather than on settings. */
const PATH_AREA: Record<string, ApiArea> = {
  'ai.writeProduct': 'products',
  'ai.suggestKeywords': 'products',
  'ai.bulkWrite': 'products',
  'ai.bulkJob': 'products',
  'ai.bulkJobs': 'products',
  'ai.cancelBulk': 'products',
  'ai.applyBulk': 'products',
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
}

/** `getGeneral` starts with `get`; `getaway` does not. */
const startsWithWord = (name: string, word: string) =>
  name === word || (name.startsWith(word) && /[A-Z]/.test(name.charAt(word.length)))

const namespaceOf = (path: string) => path.split('.')[0] ?? ''
const nameOf = (path: string) => path.split('.').at(-1) ?? ''

/** Why a path is never offered, or null when it is. */
export function exclusionReason(path: string): string | null {
  const ns = namespaceOf(path)
  return (
    EXCLUDED_NAMESPACES[ns] ??
    EXCLUDED_PATHS[path] ??
    (areaOf(path) ? null : 'no MCP & API area covers it yet')
  )
}

/** The grant area a path belongs to, or null when none does. */
export function areaOf(path: string): ApiArea | null {
  return PATH_AREA[path] ?? NAMESPACE_AREA[namespaceOf(path)] ?? null
}

/** How a procedure is treated, before looking at its input. Excluded paths are `null`. */
export function classifyAction(path: string): ActionKind | null {
  if (exclusionReason(path)) return null
  if (READ_PATHS.has(path)) return 'read'
  if (SENSITIVE_PATHS[path]) return 'sensitive'
  const name = nameOf(path)
  if (READ_NAMES.has(name) || READ_PREFIXES.some((w) => startsWithWord(name, w))) return 'read'
  if (SENSITIVE_NAMESPACES[namespaceOf(path)]) return 'sensitive'
  if (SENSITIVE_PREFIXES.some((w) => startsWithWord(name, w))) return 'sensitive'
  return 'write'
}

/** The kind for this exact call: some writes turn sensitive for some inputs. */
export function kindForInput(path: string, input: unknown): ActionKind | null {
  const kind = classifyAction(path)
  if (kind === 'write' && SENSITIVE_WHEN[path]?.when(input)) return 'sensitive'
  return kind
}

/** Why a path is sensitive, in a few words, for describe and the approval card. */
export function sensitiveNote(path: string): string | null {
  return (
    SENSITIVE_PATHS[path] ??
    SENSITIVE_NAMESPACES[namespaceOf(path)] ??
    (SENSITIVE_WHEN[path] ? `sensitive when ${SENSITIVE_WHEN[path].note}` : null) ??
    (classifyAction(path) === 'sensitive' ? 'deletes, cancels or moves money' : null)
  )
}

const words = (camel: string) =>
  camel
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()

/** `purchaseOrders.markOrdered` → "Purchase orders: mark ordered". */
export function humanName(path: string): string {
  const parts = path.split('.')
  const action = words(parts.at(-1) ?? '')
  const where = words(parts.slice(0, -1).join(' '))
  const sentence = where ? `${where}: ${action}` : action
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

export function describePath(path: string): string {
  return ACTION_DOCS[path] ?? `${humanName(path)}.`
}

/**
 * `/api/v1` (access tokens, which act at once and have no approval step): refuse what an MCP
 * client could only ask for through approval in the settings area, and anything excluded.
 */
export function apiTokenRefusal(path: string): string | null {
  if (exclusionReason(path)) return 'Access tokens cannot use this'
  if (classifyAction(path) === 'sensitive' && areaOf(path) === 'settings')
    return 'This needs a person: do it in the admin, or ask through MCP so it waits for approval'
  return null
}

/** Every procedure in a router, with its dotted path. */
export function routerProcedures(
  node: unknown,
  path: string[] = [],
  out: { path: string; procedure: AnyProcedure }[] = [],
) {
  if (isProcedure(node)) out.push({ path: path.join('.'), procedure: node })
  else if (node && typeof node === 'object')
    for (const [key, child] of Object.entries(node)) routerProcedures(child, [...path, key], out)
  return out
}

/** The procedure at a dotted path, or null. Own keys only, so `__proto__` finds nothing. */
export function procedureAt(router: unknown, path: string): AnyProcedure | null {
  let node: unknown = router
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) return null
    node = (node as Record<string, unknown>)[key]
  }
  return isProcedure(node) ? node : null
}
