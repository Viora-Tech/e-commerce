import type { PickItem, PickPage, PickTab } from '@/components/pickers/resource-pick-types'
import type { catalogsContent } from '@/data/catalogs'
import { api } from '@/lib/api-client'

/** The Browse tabs a catalog picks from. */
export type CatalogPickKind = 'products' | 'collections' | 'variants'

type FormCopy = (typeof catalogsContent)['form']

const PAGE = 30
/** The products API returns at most this many per call. */
const FETCH_MAX = 100

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  )

const matches = (title: string, search: string) =>
  !search || title.toLowerCase().includes(search.toLowerCase())

type ProductRow = Awaited<ReturnType<typeof api.products.list>>['items'][number]
type CollectionRow = Awaited<ReturnType<typeof api.collections.list>>[number]

const productItem = (p: ProductRow): PickItem => ({
  id: p.id,
  title: p.title,
  imageUrl: p.imageUrl,
})

const collectionItem = (c: CollectionRow, copy: FormCopy): PickItem => ({
  id: c.id,
  title: c.title,
  imageUrl: c.imageUrl,
  meta: copy.collectionCount(c.productCount),
})

/** One tab of the catalog's Browse dialog. */
export function catalogTab(kind: CatalogPickKind, copy: FormCopy): PickTab {
  if (kind === 'collections') {
    return {
      key: 'collections',
      label: copy.collectionsLabel,
      search: copy.searchCollections,
      empty: copy.noCollections,
      // The collections API returns the whole (small) list; it is searched and paged here.
      load: async ({ page, search }): Promise<PickPage> => {
        const all = (await api.collections.list()).filter((c) => matches(c.title, search))
        return {
          items: all.slice((page - 1) * PAGE, page * PAGE).map((c) => collectionItem(c, copy)),
          total: all.length,
        }
      },
    }
  }
  if (kind === 'variants') {
    return {
      key: 'variants',
      label: copy.variantsTab,
      search: copy.searchVariants,
      empty: copy.noVariants,
      // Variant search answers one page of matching products with all their variants.
      load: async ({ page, search }): Promise<PickPage> => {
        if (page > 1) return { items: [], total: 0 }
        const rows = await api.products.searchVariants({ search: search || undefined, limit: 20 })
        const items = rows.map((r) => ({
          id: r.variantId,
          title:
            r.variantTitle && r.variantTitle !== 'Default'
              ? `${r.title} · ${r.variantTitle}`
              : r.title,
          imageUrl: r.imageUrl,
          meta: r.sku ?? undefined,
        }))
        return { items, total: items.length }
      },
    }
  }
  return {
    key: 'products',
    label: copy.productsLabel,
    search: copy.searchProducts,
    empty: copy.noProducts,
    load: async ({ page, search }): Promise<PickPage> => {
      const r = await api.products.list({ page, perPage: PAGE, search: search || undefined })
      return { items: r.items.map(productItem), total: r.total }
    },
  }
}

/** Rows for products or collections already chosen, however far down the list they are. */
export async function loadCatalogPicked(
  kind: CatalogPickKind,
  ids: string[],
  copy: FormCopy,
): Promise<PickItem[]> {
  if (ids.length === 0 || kind === 'variants') return []
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
  return pages.flatMap((r) => r.items).map(productItem)
}
