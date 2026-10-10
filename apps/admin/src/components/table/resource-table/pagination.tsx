'use client'

import { siteConfig } from '@commerce/config/site'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type PaginationProps = {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  /** Shows the rows-per-page select (options from `siteConfig.ui.rowsPerPage`) when given. */
  onPerPageChange?: ((perPage: number) => void) | undefined
}

/* Table footer (Figma "Table · Footer"): "Showing x-y of n" on the left; rows per page, page x of
   y and two arrow buttons on the right. */
const ARROW =
  'flex size-[1.875rem] items-center justify-center rounded-[0.5rem] border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'

export default function ResourceTablePagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
}: PaginationProps) {
  // Hooks
  const tableCopy = useCopy(tableContent)

  // Render logic
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)

  return (
    <nav
      aria-label="Pagination"
      className="flex min-h-[3.25rem] items-center justify-between gap-3 border-t border-line px-5 py-2.5 text-[0.8125rem] leading-[1.1875rem] text-muted-foreground"
    >
      <span className="tabular-nums">{tableCopy.showing(from, to, total)}</span>
      <div className="flex items-center gap-3">
        {onPerPageChange ? (
          <label className="hidden items-center gap-2 sm:flex">
            <span>{tableCopy.rowsPerPage}</span>
            {/* Figma Rows select (260:1620): a small field with its own chevron, not the OS arrow. */}
            <span className="relative inline-flex">
              <select
                value={perPage}
                onChange={(e) => onPerPageChange(Number(e.target.value))}
                className="h-[1.875rem] cursor-pointer appearance-none rounded-[0.5rem] border border-input bg-input-surface pr-7 pl-2.5 text-[0.8125rem] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {siteConfig.ui.rowsPerPage.options.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDownIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </span>
          </label>
        ) : null}
        <span className="hidden tabular-nums sm:inline">{tableCopy.pageOf(page, totalPages)}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={ARROW}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={tableCopy.previous}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className={ARROW}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label={tableCopy.next}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </nav>
  )
}
