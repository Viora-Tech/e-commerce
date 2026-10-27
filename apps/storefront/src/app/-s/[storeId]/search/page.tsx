import { browseProducts } from '@commerce/core'
import {
  parseBrowseFilters,
  parseBrowseSort,
  parsePage,
  parseUnavailable,
  type SearchParamsInput,
} from '@commerce/core/browse'
import type { Metadata } from 'next'
import MainSearch from '@/components/search/main-search'
import { SEARCH_SORTS } from '@/data/browse'
import { SEARCH_PER_PAGE, searchContent } from '@/data/search'
import { listCardProducts } from '@/lib/catalog'
import { digest } from '@/lib/liquid-cache'
import { storeRead } from '@/lib/store-cache'
import '@/lib/search-engine'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<SearchParamsInput>
}

const text = (v: string | string[] | undefined) => (typeof v === 'string' ? v : (v?.[0] ?? ''))

export async function generateMetadata({
  searchParams,
}: Pick<Params, 'searchParams'>): Promise<Metadata> {
  const q = text((await searchParams).q).trim()
  // Result pages are thin and endless; Shopify keeps them out of the index too.
  return {
    title: q ? searchContent.titleFor(q) : searchContent.title,
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ params, searchParams }: Params) {
  const { storeId } = await params
  const query = await searchParams
  const q = text(query.q).trim().slice(0, 100)
  const filters = parseBrowseFilters(query)
  const sort = parseBrowseSort(query.sort_by, SEARCH_SORTS, 'relevance')
  const page = parsePage(query.page)
  const unavailable = parseUnavailable(query['options[unavailable_products]'])
  // The same search is the same page for everyone: cached per store version.
  const { result, products } = q
    ? await storeRead(
        storeId,
        `search|${digest([q, filters, sort, page, unavailable])}`,
        async (tx) => {
          const result = await browseProducts(tx, {
            query: q,
            storeId,
            filters,
            sort,
            page,
            perPage: SEARCH_PER_PAGE,
            unavailable,
          })
          const products = await listCardProducts(tx, SEARCH_PER_PAGE, undefined, result.handles)
          return { result, products }
        },
      )
    : { result: null, products: [] }
  return renderTemplate(storeId, 'search', {
    view: text(query.view) || undefined,
    renderers: {
      MainSearch: (settings) => (
        <MainSearch
          query={q}
          products={products}
          result={result}
          filters={filters}
          sort={sort}
          page={page}
          settings={settings}
        />
      ),
    },
  })
}
