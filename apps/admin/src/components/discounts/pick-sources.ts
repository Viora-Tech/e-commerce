import type { PickItem, PickPage, PickTab } from '@/components/pickers/resource-pick-types'
import type { discountFormContent } from '@/data/discounts'
import { api } from '@/lib/api-client'
import type { Locale } from '@/lib/i18n'
import { formatPaise } from '@/lib/money'

/** Rows the Browse picker can choose for a discount's "Applies to". */
export type ItemKind = 'products' | 'collections'

type ValueCopy = (typeof discountFormContent)['value']

const PAGE = 30
/** The products API returns at most this many per call. */
const FETCH_MAX = 100

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  )

type ProductRow = Awaited<ReturnType<typeof api.products.list>>['items'][number]
type CollectionRow = Awaited<ReturnType<typeof api.collections.list>>[number]

function productItem(p: ProductRow, copy: ValueCopy, locale: Locale): PickItem {
  return {
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    meta:
      p.minPricePaise === null
        ? undefined
        : copy.productMeta(formatPaise(p.minPricePaise, locale), p.available),
  }
}

function collectionItem(c: CollectionRow, copy: ValueCopy): PickItem {
  return { id: c.id, title: c.title, imageUrl: c.imageUrl, meta: copy.productCount(c.productCount) }
}

const matches = (title: string, search: string) =>
  !search || title.toLowerCase().includes(search.toLowerCase())

/** The Products and Collections tabs of the discount's Browse dialog. */
export function itemTabs(copy: ValueCopy, locale: Locale): PickTab[] {
  return [
    {
      key: 'products',
      label: copy.tabs.products,
      search: copy.productSearch,
      empty: copy.noProducts,
      load: async ({ page, search }): Promise<PickPage> => {
        const r = await api.products.list({ page, perPage: PAGE, search: search || undefined })
        return { items: r.items.map((p) => productItem(p, copy, locale)), total: r.total }
      },
    },
    {
      key: 'collections',
      label: copy.tabs.collections,
      search: copy.collectionSearch,
      empty: copy.noCollections,
      // The collections API returns the whole (small) list; it is searched and paged here.
      load: async ({ page, search }): Promise<PickPage> => {
        const all = (await api.collections.list()).filter((c) => matches(c.title, search))
        return {
          items: all.slice((page - 1) * PAGE, page * PAGE).map((c) => collectionItem(c, copy)),
          total: all.length,
        }
      },
    },
  ]
}

/** The rows for ids already chosen, however far down the store's list they are. */
export async function loadPicked(
  kind: ItemKind,
  ids: string[],
  copy: ValueCopy,
  locale: Locale,
): Promise<PickItem[]> {
  if (ids.length === 0) return []
  if (kind === 'collections') {
    const wanted = new Set(ids)
    return (await api.collections.list())
      .filter((c) => wanted.has(c.id))
      .map((c) => collectionItem(c, copy))
  }
  const pages = await Promise.all(
    chunks(ids, FETCH_MAX).map((part) =>
      api.products.list({ page: 1, perPage: part.length, ids: part }),
    ),
  )
  return pages.flatMap((r) => r.items).map((p) => productItem(p, copy, locale))
}

/** What one combo of a combo deal is made of: products (any variant) or exact variants. */
export type ComboKind = 'products' | 'variants'

type ComboCopy = (typeof discountFormContent)['combos']
type VariantRow = Awaited<ReturnType<typeof api.products.searchVariants>>[number]
/** The variant search answers at most this many per call. */
const VARIANT_MAX = 50

function variantItem(v: VariantRow, locale: Locale): PickItem {
  const named = v.variantTitle && v.variantTitle !== 'Default'
  const price = v.pricePaise === null ? null : formatPaise(v.pricePaise, locale)
  return {
    id: v.variantId,
    title: named ? `${v.title} · ${v.variantTitle}` : v.title,
    imageUrl: v.imageUrl,
    meta: [price, v.sku].filter(Boolean).join(' · ') || undefined,
  }
}

/** The Products and Variants tabs of a combo's Browse dialog. */
export function comboTabs(copy: ValueCopy, comboCopy: ComboCopy, locale: Locale): PickTab[] {
  const [products] = itemTabs(copy, locale) as [PickTab, ...PickTab[]]
  return [
    { ...products, label: comboCopy.scopes.products },
    {
      key: 'variants',
      label: comboCopy.scopes.variants,
      search: comboCopy.variantSearch,
      empty: comboCopy.noVariants,
      // Variant search answers one page of matching products with all their variants.
      load: async ({ page, search }): Promise<PickPage> => {
        if (page > 1) return { items: [], total: 0 }
        const rows = await api.products.searchVariants({ search: search || undefined, limit: 20 })
        const items = rows.map((v) => variantItem(v, locale))
        return { items, total: items.length }
      },
    },
  ]
}

/** Rows for a saved combo's products or variants. */
export async function loadComboPicked(
  kind: ComboKind,
  ids: string[],
  copy: ValueCopy,
  locale: Locale,
): Promise<PickItem[]> {
  if (ids.length === 0) return []
  if (kind === 'products') return loadPicked('products', ids, copy, locale)
  const pages = await Promise.all(
    chunks(ids, VARIANT_MAX).map((part) =>
      api.products.searchVariants({ ids: part, limit: VARIANT_MAX }),
    ),
  )
  return pages.flat().map((v) => variantItem(v, locale))
}

/** Who a discount is limited to: customer segments or individual customers. */
export type PeopleKind = 'segments' | 'customers'

type EligibilityCopy = (typeof discountFormContent)['eligibility']
type SegmentRow = Awaited<ReturnType<typeof api.customers.segments>>[number]
type CustomerRow = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

const segmentItem = (s: SegmentRow, copy: EligibilityCopy): PickItem => ({
  id: s.id,
  title: s.name,
  thumb: 'none',
  meta: copy.members(s.customerCount),
})

const customerItem = (c: CustomerRow, copy: EligibilityCopy): PickItem => ({
  id: c.id,
  title: c.name || c.email || c.phone || '—',
  subtitle: c.name ? (c.email ?? c.phone ?? undefined) : undefined,
  thumb: 'initial',
  meta: copy.orders(c.orderCount),
})

/** The one tab the eligibility Browse dialog shows. */
export function peopleTab(kind: PeopleKind, copy: EligibilityCopy): PickTab {
  if (kind === 'segments') {
    return {
      key: 'segments',
      label: copy.segmentsTab,
      search: copy.segmentSearch,
      empty: copy.noSegments,
      // Segments are few; the API returns them all, searched and paged here.
      load: async ({ page, search }) => {
        const all = (await api.customers.segments()).filter((s) => matches(s.name, search))
        return {
          items: all.slice((page - 1) * PAGE, page * PAGE).map((s) => segmentItem(s, copy)),
          total: all.length,
        }
      },
    }
  }
  return {
    key: 'customers',
    label: copy.customersTab,
    search: copy.customerSearch,
    empty: copy.noCustomers,
    load: async ({ page, search }) => {
      const r = await api.customers.list({
        page,
        perPage: PAGE,
        search: search || undefined,
        sort: 'name',
      })
      return { items: r.items.map((c) => customerItem(c, copy)), total: r.total }
    },
  }
}

/** Rows for segment or customer ids already chosen. */
export async function loadPeople(
  kind: PeopleKind,
  ids: string[],
  copy: EligibilityCopy,
): Promise<PickItem[]> {
  if (ids.length === 0) return []
  if (kind === 'segments') {
    const wanted = new Set(ids)
    return (await api.customers.segments())
      .filter((s) => wanted.has(s.id))
      .map((s) => segmentItem(s, copy))
  }
  const pages = await Promise.all(
    chunks(ids, FETCH_MAX).map((part) =>
      api.customers.list({ page: 1, perPage: part.length, ids: part }),
    ),
  )
  return pages.flatMap((r) => r.items).map((c) => customerItem(c, copy))
}
