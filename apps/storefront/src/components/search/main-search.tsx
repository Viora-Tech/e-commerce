import type { CardProduct } from '@commerce/blocks'
import { Icon } from '@commerce/blocks'
import type { BrowseResult } from '@commerce/core'
import type { BrowseFilters, BrowseSort } from '@commerce/core/browse'
import { hasActiveFilters } from '@commerce/core/browse'
import Link from 'next/link'
import BrowseResults from '@/components/browse/browse-results'
import { SEARCH_SORTS } from '@/data/browse'
import { searchContent as copy, SEARCH_PER_PAGE } from '@/data/search'
import { blockCardsFor } from '@/lib/liquid-cards'

type MainSearchProps = {
  storeId: string
  query: string
  products: CardProduct[]
  /** Null until the shopper has typed something. */
  result: BrowseResult | null
  filters: BrowseFilters
  sort: BrowseSort
  page: number
  settings: { showFilters?: unknown; showSort?: unknown }
}

/** The search template's main section: the query box, then filtered, sortable results. */
export default async function MainSearch({
  storeId,
  query,
  products,
  result,
  filters,
  sort,
  page,
  settings,
}: MainSearchProps) {
  // Hooks
  const themeCards = await blockCardsFor(
    storeId,
    products.map((p) => p.handle),
  )

  // Render logic
  const nothing = result !== null && result.total === 0 && !hasActiveFilters(filters)
  const jsonLd = result
    ? {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: copy.titleFor(query),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: result.total,
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: (page - 1) * SEARCH_PER_PAGE + i + 1,
            url: `/products/${p.handle}`,
            name: p.title,
          })),
        },
      }
    : null

  return (
    <section className="page-width py-10 md:py-12">
      {jsonLd ? (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; the replace keeps "</script>" out.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <h1 className="section-title search-page__title">{copy.title}</h1>
      <search className="search-page__search">
        <form action="/search" method="get" className="search-page__form">
          <label htmlFor="search-q" className="visually-hidden">
            {copy.label}
          </label>
          <span className="search-page__field">
            <Icon name="search" size={16} />
            <input
              id="search-q"
              className="search-page__input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={copy.placeholder}
              autoComplete="off"
            />
          </span>
          <button className="btn btn--primary search-page__submit" type="submit">
            {copy.submit}
          </button>
        </form>
      </search>

      {result === null ? (
        <div className="flex flex-col gap-2">
          <p className="h4">{copy.promptTitle}</p>
          <p className="text-body text-muted">{copy.promptBody}</p>
        </div>
      ) : nothing ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-line p-8">
          <p className="h4">{copy.emptyTitle(query)}</p>
          <p className="text-body text-muted">{copy.emptyBody}</p>
          <Link href="/collections" className="btn btn--secondary btn--small mt-2">
            {copy.browseCollections}
          </Link>
        </div>
      ) : (
        <>
          {result.corrected ? (
            <p className="text-body text-muted">
              {copy.searchInstead(query)}{' '}
              <span className="font-medium text-ink">{copy.correctedTo(result.corrected)}</span>
            </p>
          ) : null}
          <BrowseResults
            path="/search"
            q={query}
            products={products}
            total={result.total}
            facets={result.facets}
            filterConfig={result.filterConfig}
            filters={filters}
            sort={sort}
            defaultSort="relevance"
            sorts={SEARCH_SORTS}
            page={page}
            perPage={SEARCH_PER_PAGE}
            showFilters={settings.showFilters !== false}
            showSort={settings.showSort !== false}
            grid={{ themeCards }}
          />
        </>
      )}
    </section>
  )
}
