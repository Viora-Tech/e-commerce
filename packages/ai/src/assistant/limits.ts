/**
 * SOURCE OF TRUTH: the AI assistant's hard limits and page context — WHAT how much one
 * assistant action may change, how long a proposal stays open, which admin pages it knows
 * about / WHY the API, the tools and the admin bar enforce and show the same numbers.
 * Pure and client-safe.
 */

export const ASSISTANT_LIMITS = {
  /** Most products, variants or orders one approved action may touch. */
  maxItemsPerAction: 200,
  /** Most change proposals the assistant may prepare in one answer. */
  maxProposalsPerTurn: 3,
  /** Bulk price change bounds, in percent. */
  minPricePercent: -50,
  maxPricePercent: 100,
  /** A proposal not approved within this many minutes expires. */
  proposalTtlMinutes: 60,
  /** Longest order note or reply draft. */
  maxNoteLength: 2000,
} as const

/** Longest message the merchant can send, and how many earlier messages go back as context. */
export const ASSISTANT_MAX_MESSAGE = 1000
export const ASSISTANT_MAX_HISTORY = 8

/** Admin pages the assistant recognises; anything else is `other`. */
export const ASSISTANT_PAGES = [
  'home',
  'products',
  'product',
  'collections',
  'collection',
  'orders',
  'order',
  'discounts',
  'customers',
  'customer',
  'analytics',
  'settings',
  /** Online store → Themes → Customize; the record id is the theme's. */
  'theme-editor',
  'other',
] as const
export type AssistantPage = (typeof ASSISTANT_PAGES)[number]

/** Where the merchant is: the page kind, and the record's id on a detail page. */
export type AssistantPageContext = { page: AssistantPage; entityId: string | null }

const DETAIL: { prefix: string; page: AssistantPage; list: AssistantPage }[] = [
  { prefix: '/products/collections', page: 'collection', list: 'collections' },
  { prefix: '/products', page: 'product', list: 'products' },
  { prefix: '/orders', page: 'order', list: 'orders' },
  { prefix: '/customers', page: 'customer', list: 'customers' },
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The theme editor: `/online-store/themes/<uuid>/editor`. */
const THEME_EDITOR = /^\/online-store\/themes\/([^/]+)\/editor(?:\/|$)/

/** The assistant's page context for an admin path, e.g. `/products/<uuid>` → product + id. */
export function pageContextFor(pathname: string): AssistantPageContext {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { page: 'home', entityId: null }
  const editor = THEME_EDITOR.exec(path)?.[1]
  if (editor && UUID.test(editor)) return { page: 'theme-editor', entityId: editor }
  for (const { prefix, page, list } of DETAIL) {
    if (path === prefix) return { page: list, entityId: null }
    if (!path.startsWith(`${prefix}/`)) continue
    const id = path.slice(prefix.length + 1).split('/')[0] ?? ''
    if (UUID.test(id)) return { page, entityId: id }
    // `/products/collections` sits under `/products`: let the longer prefix answer it.
    if (prefix === '/products' && id === 'collections') continue
    return { page: list, entityId: null }
  }
  if (path.startsWith('/discounts')) return { page: 'discounts', entityId: null }
  if (path.startsWith('/analytics')) return { page: 'analytics', entityId: null }
  if (path.startsWith('/settings')) return { page: 'settings', entityId: null }
  return { page: 'other', entityId: null }
}
