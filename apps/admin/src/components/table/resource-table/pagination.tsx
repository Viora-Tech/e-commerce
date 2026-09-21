'use client'

import { cn } from '@commerce/ui/lib/utils'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { tableContent } from '@/data/table'

type PaginationProps = {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
}

const EDGE_PAGES = 5

/* 5:2856: 42px edge buttons with a 24px arrow; 5:2865: 36px squares, 4px radius. */
const EDGE =
  'flex h-8 items-center gap-1 rounded-lg border border-line bg-card px-2 text-xs font-medium text-ink-strong transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'
const SQUARE =
  'flex size-8 items-center justify-center rounded-[0.25rem] text-xs text-ink-strong transition-colors'

type Slot = number | 'gap'

/** First five pages, a gap, then the last page; the kit shows "1 2 3 4 5 ..... 24". */
function pageSlots(current: number, totalPages: number): Slot[] {
  if (totalPages <= EDGE_PAGES + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const start = Math.max(1, Math.min(current - 2, totalPages - EDGE_PAGES))
  const head = Array.from({ length: EDGE_PAGES }, (_, i) => start + i)
  const tail: Slot[] = head[head.length - 1] === totalPages ? [] : ['gap', totalPages]
  const lead: Slot[] = start > 1 ? [1, 'gap'] : []
  return [...lead, ...head, ...tail]
}

export function ResourceTablePagination({ page, perPage, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const slots = pageSlots(page, totalPages)

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
      <button
        type="button"
        className={cn(EDGE, 'pr-3')}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ArrowLeft strokeWidth={1.6} />
        {tableContent.previousLabel}
      </button>
      <ol className="flex items-center gap-2">
        {slots.map((slot, i) =>
          slot === 'gap' ? (
            <li key={`gap-${i.toString()}`} className={cn(SQUARE, 'border border-line font-bold')}>
              {tableContent.ellipsis}
            </li>
          ) : (
            <li key={slot}>
              <button
                type="button"
                aria-current={slot === page ? 'page' : undefined}
                onClick={() => onPageChange(slot)}
                className={cn(
                  SQUARE,
                  slot === page
                    ? 'bg-primary-tint font-bold'
                    : 'border border-line font-medium hover:bg-muted',
                )}
              >
                {slot}
              </button>
            </li>
          ),
        )}
      </ol>
      <button
        type="button"
        className={cn(EDGE, 'pl-4')}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {tableContent.nextLabel}
        <ArrowRight strokeWidth={1.6} />
      </button>
    </nav>
  )
}
