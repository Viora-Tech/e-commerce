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
