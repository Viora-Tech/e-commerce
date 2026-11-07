import { browseProducts } from '@commerce/core'
import {
  type BrowseSort,
  hasActiveFilters,
  parseBrowseFilters,
  parseBrowseSort,
  parsePage,
  type SearchParamsInput,
} from '@commerce/core/browse'
import type { CollectionSort } from '@commerce/core/collections'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MainCollection from '@/components/collections/main-collection'
import { COLLECTION_SORTS } from '@/data/browse'
import { COLLECTION_PER_PAGE } from '@/data/collections'
import { listCardProducts } from '@/lib/catalog'
import { getCollectionByHandle } from '@/lib/collections'
import { digest } from '@/lib/liquid-cache'
import { marketCanonical, metaDescription, requestOrigin } from '@/lib/seo'
import { storeShareImages } from '@/lib/share-image'
import { storeRead } from '@/lib/store-cache'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<SearchParamsInput>
}

/** The merchant's saved collection order, in the storefront's `sort_by` vocabulary. */
const DEFAULT_SORT: Record<CollectionSort, BrowseSort> = {
  manual: 'manual',
  title_asc: 'title-ascending',
  title_desc: 'title-descending',
  price_asc: 'price-ascending',
  price_desc: 'price-descending',
  created_desc: 'created-descending',
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { storeId, handle } = await params
  const found = await storeRead(storeId, `collection|${handle}`, (tx) =>
    getCollectionByHandle(tx, handle),
  )
  if (!found) return {}
  const query = await searchParams
  const title = found.seoTitle || found.title
  const description = metaDescription(
    found.seoDescription || richTextToPlainText(parseRichText(found.description)),
  )
  // Filtered and re-sorted views are the same collection: they point at the plain
  // page and stay out of the index, as Shopify's do.
  const url = await marketCanonical(`/collections/${found.handle}`, parsePage(query.page))
  const variant = hasActiveFilters(parseBrowseFilters(query)) || query.sort_by !== undefined
  const image = found.imageUrl ? [{ url: found.imageUrl, alt: found.title }] : undefined
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: image ?? (await storeShareImages(storeId)),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
    ...(variant ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function CollectionPage({ params, searchParams }: Params) {
  const { storeId, handle } = await params
  const query = await searchParams
  const page = parsePage(query.page)
  const filters = parseBrowseFilters(query)

  // A collection page (with its filters, sort and page) is the same for everyone: cached per
  // store version.
  const view = [handle, page, filters, query.sort_by ?? null, query.sort ?? null]
  const data = await storeRead(storeId, `collection-page|${digest(view)}`, async (tx) => {
    const found = await getCollectionByHandle(tx, handle)
    if (!found) return null
    const defaultSort = DEFAULT_SORT[found.sortOrder]
    // `sort` is the old parameter; links shared before sort_by keep working.
    const legacy =
      typeof query.sort === 'string' ? DEFAULT_SORT[query.sort as CollectionSort] : undefined
    const sort = parseBrowseSort(query.sort_by ?? legacy, COLLECTION_SORTS, defaultSort)
    const result = await browseProducts(tx, {
      collectionId: found.id || undefined,
      // Names the store, so its filter settings come with the listing.
      storeId,
      filters,
      sort,
      page,
      perPage: COLLECTION_PER_PAGE,
    })
    const products = await listCardProducts(tx, COLLECTION_PER_PAGE, undefined, result.handles)
    return { collection: found, result, products, sort, defaultSort }
  })

  if (!data) notFound()
  const origin = await requestOrigin()
  return renderTemplate(storeId, 'collection', {
    suffix: data.collection.templateSuffix,
    sources: { collectionId: data.collection.id || undefined },
    view: typeof query.view === 'string' ? query.view : undefined,
    renderers: {
      MainCollection: (settings) => (
        <MainCollection
          storeId={storeId}
          origin={origin}
          collection={data.collection}
          products={data.products}
          result={data.result}
          filters={filters}
          sort={data.sort}
          defaultSort={data.defaultSort}
          page={page}
          settings={settings}
        />
      ),
    },
  })
}
