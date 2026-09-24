'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { tableContent } from '@/data/table'

type PaginationProps = {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
}

/* Pager after the Saleor Dashboard datagrid footer (BSD-3): the visible range on the
   left, page position and two 32px arrow buttons on the right. */
const ARROW =
  'flex size-8 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:border-border-strong hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'

export default function ResourceTablePagination({
  page,
  perPage,
  total,
  onPageChange,
}: PaginationProps) {
  // Render logic
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)

  return (
    <nav
      aria-label="Pagination"
      className="flex min-h-13 items-center justify-between gap-3 px-4 py-2.5 text-body md:px-6 text-muted-foreground"
    >
      <span className="tabular-nums">{tableContent.range(from, to, total)}</span>
      <div className="flex items-center gap-3">
        <span className="hidden tabular-nums sm:inline">
          {tableContent.pageOf(page, totalPages)}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={ARROW}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={tableContent.previous}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className={ARROW}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label={tableContent.next}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </nav>
  )
}
