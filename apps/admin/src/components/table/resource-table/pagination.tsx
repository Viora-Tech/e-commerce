'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { tableContent } from '@/data/table'

type PaginationProps = {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
}

/** Server-paged footer: "1–25 of 312" plus previous/next. */
export function ResourceTablePagination({ page, perPage, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="flex items-center justify-between border-t px-3 py-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        {total === 0 ? tableContent.noResults : tableContent.range(from, to, total)}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={tableContent.previous}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={tableContent.next}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
