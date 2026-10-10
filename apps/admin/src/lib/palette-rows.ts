import type { LucideIcon } from '@commerce/ui/icons'
import { type PaletteScope, type RecentEntry, searchHref } from '@/lib/palette-search'

export type OrderHit = {
  id: string
  number: number
  customerName: string | null
  status: string
  totalPaise: number
  placedAt: Date | string
  imageUrl: string | null
}

export type ProductHit = {
  id: string
  title: string
  status: string
  imageUrl: string | null
  minPricePaise: number | null
  maxPricePaise: number | null
  available: number
}

export type CustomerHit = {
  id: string
  name: string
  email: string | null
  phone: string | null
  orderCount: number
}

/** One group of records and how many exist in all (the rows are only the first few). */
export type Hits<T> = { items: T[]; total: number }

/** A page, a setting or a quick action, already named in the member's language. */
export type LinkRow = {
  href: string
  label: string
  hint?: string
  icon: LucideIcon
  shortcut?: string[]
}

export type PaletteRow =
  | { kind: 'ask'; id: string; query: string }
  | { kind: 'recent'; id: string; href: string; entry: RecentEntry }
  | ({ kind: 'action' | 'page' | 'setting'; id: string } & LinkRow)
  | { kind: 'theme'; id: string; label: string }
  | { kind: 'order'; id: string; href: string; hit: OrderHit }
  | { kind: 'product'; id: string; href: string; hit: ProductHit }
  | { kind: 'customer'; id: string; href: string; hit: CustomerHit }
  | { kind: 'more'; id: string; href: string; label: string; recent: RecentEntry }

export type PaletteSection = {
  key: string
  /** Absent for the Ask AI row, which sits above the groups. */
  heading?: string
  count?: number
  rows: PaletteRow[]
}

/** Rows per group on "All", and when one scope is chosen. */
export const ALL_LIMIT = 5
export const SCOPE_LIMIT = 10

type SectionCopy = {
  sections: {
    recent: string
    actions: string
    goTo: string
    orders: string
    products: string
    customers: string
    pages: string
    settings: string
  }
  seeAll: (n: number) => string
  browse: { orders: string; products: string; customers: string }
}

export type BuildInput = {
  query: string
  scope: PaletteScope
  copy: SectionCopy
  aiEnabled: boolean
  recents: RecentEntry[]
  orders: Hits<OrderHit> | null
  products: Hits<ProductHit> | null
  customers: Hits<CustomerHit> | null
  /** Quick actions that match, then pages, then settings fields, all permission-checked. */
  actions: LinkRow[]
  pages: LinkRow[]
  settings: LinkRow[]
  themeLabel: string | null
  listHrefs: { orders: string; products: string; customers: string }
}

function linkRows(kind: 'action' | 'page' | 'setting', links: LinkRow[]): PaletteRow[] {
  return links.map((l) => ({ kind, id: `${kind}-${l.href}-${l.label}`, ...l }))
}

function moreRow(
  key: 'orders' | 'products' | 'customers',
  input: BuildInput,
  total: number,
  shown: number,
): PaletteRow[] {
  if (total <= shown) return []
  const href = searchHref(input.listHrefs[key], input.query)
  return [
    {
      kind: 'more',
      id: `more-${key}`,
      href,
      label: input.copy.seeAll(total),
      recent: { label: input.query, href, hint: input.copy.sections[key] },
    },
  ]
}

function recordSections(input: BuildInput, limit: number): PaletteSection[] {
  const { scope, copy } = input
  const sections: PaletteSection[] = []
  const wants = (s: PaletteScope) => scope === 'all' || scope === s
  if (wants('orders') && input.orders && input.orders.items.length > 0) {
    const items = input.orders.items.slice(0, limit)
    sections.push({
      key: 'orders',
      heading: copy.sections.orders,
      count: input.orders.total,
      rows: [
        ...items.map(
          (hit): PaletteRow => ({
            kind: 'order',
            id: `order-${hit.id}`,
            href: `/orders/${hit.id}`,
            hit,
          }),
        ),
        ...moreRow('orders', input, input.orders.total, items.length),
      ],
    })
  }
  if (wants('products') && input.products && input.products.items.length > 0) {
    const items = input.products.items.slice(0, limit)
    sections.push({
      key: 'products',
      heading: copy.sections.products,
      count: input.products.total,
      rows: [
        ...items.map(
          (hit): PaletteRow => ({
            kind: 'product',
            id: `product-${hit.id}`,
            href: `/products/${hit.id}`,
            hit,
          }),
        ),
        ...moreRow('products', input, input.products.total, items.length),
      ],
    })
  }
  if (wants('customers') && input.customers && input.customers.items.length > 0) {
    const items = input.customers.items.slice(0, limit)
    sections.push({
      key: 'customers',
      heading: copy.sections.customers,
      count: input.customers.total,
      rows: [
        ...items.map(
          (hit): PaletteRow => ({
            kind: 'customer',
            id: `customer-${hit.id}`,
            href: `/customers/${hit.id}`,
            hit,
          }),
        ),
        ...moreRow('customers', input, input.customers.total, items.length),
      ],
    })
  }
  return sections
}

/** Nothing typed: recents, quick actions and the main pages; a record scope offers its list. */
function idleSections(input: BuildInput): PaletteSection[] {
  const { scope, copy } = input
  if (scope === 'orders' || scope === 'products' || scope === 'customers') {
    const href = input.listHrefs[scope]
    return [
      {
        key: 'browse',
        rows: [
          {
            kind: 'more',
            id: `browse-${scope}`,
            href,
            label: copy.browse[scope],
            recent: { label: copy.browse[scope], href },
          },
        ],
      },
    ]
  }
  if (scope === 'pages') {
    return [{ key: 'pages', heading: copy.sections.pages, rows: linkRows('page', input.pages) }]
  }
  if (scope === 'settings') {
    return [
      {
        key: 'settings',
        heading: copy.sections.settings,
        rows: linkRows('setting', input.settings),
      },
    ]
  }
  const sections: PaletteSection[] = []
  if (input.recents.length > 0) {
    sections.push({
      key: 'recent',
      heading: copy.sections.recent,
      rows: input.recents.map((entry) => ({
        kind: 'recent',
        id: `recent-${entry.href}`,
        href: entry.href,
        entry,
      })),
    })
  }
  sections.push({
    key: 'actions',
    heading: copy.sections.actions,
    rows: [
      ...linkRows('action', input.actions),
      ...(input.themeLabel
        ? [{ kind: 'theme' as const, id: 'theme', label: input.themeLabel }]
        : []),
    ],
  })
  sections.push({ key: 'goTo', heading: copy.sections.goTo, rows: linkRows('page', input.pages) })
  return sections.filter((s) => s.rows.length > 0)
}

/**
 * What the palette lists, top to bottom. With a query: the Ask AI row, then the record groups
 * (five each on All, ten in one scope), then matching actions, pages and settings. With none:
 * recents, quick actions and pages.
 */
export function buildSections(input: BuildInput): PaletteSection[] {
  if (!input.query) return idleSections(input)
  const { scope, copy } = input
  const limit = scope === 'all' ? ALL_LIMIT : SCOPE_LIMIT
  const sections: PaletteSection[] = []
  if (input.aiEnabled) {
    sections.push({ key: 'ask', rows: [{ kind: 'ask', id: 'ask', query: input.query }] })
  }
  sections.push(...recordSections(input, limit))
  if (scope === 'all') {
    const actions = [
      ...linkRows('action', input.actions),
      ...(input.themeLabel
        ? [{ kind: 'theme' as const, id: 'theme', label: input.themeLabel }]
        : []),
    ]
    if (actions.length > 0) {
      sections.push({ key: 'actions', heading: copy.sections.actions, rows: actions })
    }
  }
  if (scope === 'all' || scope === 'pages') {
    const pages = linkRows('page', input.pages.slice(0, limit))
    if (pages.length > 0) {
      sections.push({ key: 'pages', heading: copy.sections.pages, rows: pages })
    }
  }
  if (scope === 'all' || scope === 'settings') {
    const settings = linkRows('setting', input.settings.slice(0, limit))
    if (settings.length > 0) {
      sections.push({ key: 'settings', heading: copy.sections.settings, rows: settings })
    }
  }
  return sections
}

/** Every row in reading order, for arrow-key movement. */
export function flattenRows(sections: readonly PaletteSection[]): PaletteRow[] {
  return sections.flatMap((s) => s.rows)
}

/** Records and links the results actually found, not counting Ask AI, for the "N results" line. */
export function resultCount(sections: readonly PaletteSection[]): number {
  return flattenRows(sections).filter((r) => r.kind !== 'ask' && r.kind !== 'more').length
}

/** Where a row goes, or null for rows that act instead (Ask AI, theme). */
export function rowHref(row: PaletteRow): string | null {
  switch (row.kind) {
    case 'ask':
    case 'theme':
      return null
    default:
      return row.href
  }
}

/** What to remember when a row is opened: records and pages are, quick actions are not. */
export function rowRecent(
  row: PaletteRow,
  hints: { order: string; product: string; customer: string },
): RecentEntry | null {
  switch (row.kind) {
    case 'order':
      return { label: `#${row.hit.number}`, href: row.href, hint: hints.order }
    case 'product':
      return { label: row.hit.title, href: row.href, hint: hints.product }
    case 'customer':
      return { label: row.hit.name, href: row.href, hint: hints.customer }
    case 'page':
    case 'setting':
      return { label: row.label, href: row.href, ...(row.hint ? { hint: row.hint } : {}) }
    case 'more':
      return row.recent
    default:
      return null
  }
}
