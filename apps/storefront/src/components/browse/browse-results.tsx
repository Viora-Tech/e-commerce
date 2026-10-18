import { type CardProduct, formatPaise, Pagination } from '@commerce/blocks'
import type { BrowseFacets } from '@commerce/core'
import {
  activeFilters,
  type BrowseFilters,
  type BrowseSort,
  browseHref,
  EMPTY_FILTERS,
  filterEntries,
  hasActiveFilters,
} from '@commerce/core/browse'
import Link from 'next/link'
import CollectionGrid from '@/components/collections/collection-grid'
import { browseContent as copy } from '@/data/browse'
import DrawerClose from './drawer-close'
import FilterForm from './filter-form'
import SortSelect from './sort-select'

type BrowseResultsProps = {
  /** Path filters and pages link to. */
  path: string
  q?: string | undefined
  products: CardProduct[]
  total: number
  facets: BrowseFacets
  filters: BrowseFilters
  sort: BrowseSort
  /** Omitted from URLs when it is the listing's own default. */
  defaultSort: BrowseSort
  sorts: BrowseSort[]
  page: number
  perPage: number
  showFilters: boolean
  showSort: boolean
  /** The count over the grid; a collection page shows it in its header instead. */
  showCount?: boolean | undefined
}

function chipLabel(kind: string, value: string, f: BrowseFilters): string {
  if (kind === 'available') return copy.chip.available(value)
  if (kind === 'price') {
    return copy.chip.price(
      f.priceMin === null ? null : formatPaise(f.priceMin),
      f.priceMax === null ? null : formatPaise(f.priceMax),
    )
  }
  return value
}

/**
 * A filtered product listing: sidebar filters on desktop, a drawer on phones
 * (a native <details>, so it opens without JavaScript), removable filter chips,
 * sort, grid and pagination. Everything is in the URL.
 */
export default function BrowseResults({
  path,
  q,
  products,
  total,
  facets,
  filters,
  sort,
  defaultSort,
  sorts,
  page,
  perPage,
  showFilters,
  showSort,
  showCount = true,
}: BrowseResultsProps) {
  // Helpers
  const sortParam = () => (sort === defaultSort ? null : sort)
  const href = (parts: { filters?: BrowseFilters; page?: number }) =>
    browseHref(path, {
      q,
      filters: parts.filters ?? filters,
      sort: sortParam(),
      page: parts.page ?? 1,
    })
  const form = (idPrefix: string) => (
    <FilterForm
      key={JSON.stringify([filters, sort])}
      action={path}
      q={q}
      sort={sortParam()}
      facets={facets}
      filters={filters}
      idPrefix={idPrefix}
    />
  )

  // Render logic
  const pages = Math.max(1, Math.ceil(total / perPage))
  const chips = activeFilters(filters)
  const filtered = hasActiveFilters(filters)
  const keep: [string, string][] = [
    ...(q ? [['q', q] as [string, string]] : []),
    ...filterEntries(filters),
  ]
  const formKey = JSON.stringify([filters, sort])

  return (
    <div className={showFilters ? 'browse browse--filters' : 'browse'}>
      {showFilters ? (
        <aside className="browse__filters" aria-label={copy.filters}>
          <div className="browse__filters-head">
            <h2 className="browse__filters-title">{copy.filters}</h2>
            {filtered ? (
              <Link
                href={href({ filters: EMPTY_FILTERS })}
                scroll={false}
                className="browse__clear"
              >
                {copy.clearAll}
              </Link>
            ) : null}
          </div>
          {form('desktop')}
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showFilters ? (
            <details className="group md:hidden">
              <summary className="btn btn--secondary btn--small list-none [&::-webkit-details-marker]:hidden">
                {copy.filters}
              </summary>
              <div className="fixed inset-0 z-50 flex flex-col bg-bg">
                <div className="flex items-center justify-between border-b border-line px-4 py-4">
                  <div className="flex flex-col">
                    <span className="h4">{copy.filters}</span>
                    <span className="text-small text-muted">{copy.productCount(total)}</span>
                  </div>
                  <DrawerClose label={copy.close} href={href({ page })} />
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-6">{form('mobile')}</div>
              </div>
            </details>
          ) : null}
          {showCount ? (
            <span className="text-small text-muted">{copy.productCount(total)}</span>
          ) : null}
          {chips.length > 0 ? (
            <ul className="browse__chips">
              {chips.map((c) => {
                const label = chipLabel(c.kind, c.value, filters)
                return (
                  <li key={c.key}>
                    <Link
                      href={href({ filters: c.without })}
                      scroll={false}
                      aria-label={copy.chip.remove(label)}
                      className="browse__chip"
                    >
                      {label}
                      <span aria-hidden="true">×</span>
                    </Link>
                  </li>
                )
              })}
              <li>
                <Link
                  href={href({ filters: EMPTY_FILTERS })}
                  scroll={false}
                  className="browse__clear"
                >
                  {copy.clearAll}
                </Link>
              </li>
            </ul>
          ) : null}
          {showSort ? (
            <SortSelect key={formKey} action={path} value={sort} options={sorts} keep={keep} />
          ) : null}
        </div>

        {filtered && products.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-line p-8">
            <p className="h4">{copy.noMatchesTitle}</p>
            <p className="text-body text-muted">{copy.noMatchesBody}</p>
            <Link
              href={href({ filters: EMPTY_FILTERS })}
              className="btn btn--secondary btn--small mt-2"
            >
              {copy.clearAll}
            </Link>
          </div>
        ) : (
          <CollectionGrid products={products} />
        )}

        <Pagination page={page} pages={pages} hrefFor={(n) => href({ page: n })} />
      </div>
    </div>
  )
}
