import { paginationContent as copy } from '../data/pagination'
import Icon from './icon'

type PaginationProps = {
  page: number
  pages: number
  /** The link for a page number. */
  hrefFor: (page: number) => string
}

/** 1 … 4 5 6 … 12: the first and last page, the current one and its neighbours. */
function pageList(page: number, pages: number): (number | 'gap')[] {
  const shown = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const sorted = [...shown].sort((a, b) => a - b)
  return sorted.flatMap((n, i) => {
    const prev = sorted[i - 1]
    return prev !== undefined && n - prev > 1 ? (['gap', n] as const) : [n]
  })
}

/** Figma Store / Pagination "Numbered" (692:81545): arrows either side of the page numbers. */
export default function Pagination({ page, pages, hrefFor }: PaginationProps) {
  // Early returns
  if (pages <= 1) return null

  // Render logic
  return (
    <nav className="pagination" aria-label={copy.label(page, pages)}>
      {page > 1 ? (
        <a
          className="pagination__step"
          href={hrefFor(page - 1)}
          rel="prev"
          aria-label={copy.previous}
        >
          <Icon name="chevron-down" size={16} />
        </a>
      ) : null}
      <ol className="pagination__pages">
        {pageList(page, pages).map((n, i) =>
          n === 'gap' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no value of its own; its place in the list is its identity.
            <li key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <a
                className="pagination__page"
                href={hrefFor(n)}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </a>
            </li>
          ),
        )}
      </ol>
      {page < pages ? (
        <a
          className="pagination__step pagination__step--next"
          href={hrefFor(page + 1)}
          rel="next"
          aria-label={copy.next}
        >
          <Icon name="chevron-down" size={16} />
        </a>
      ) : null}
    </nav>
  )
}
