'use client'

import { siteConfig } from '@commerce/config/site'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
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

type PageSlot = number | 'gap-start' | 'gap-end'

/* Figma "Table / Footer" + "Pagination": the summary on the left; rows per page, then Previous,
   numbered 36px pages (the current one outlined), an ellipsis and Next on the right. */
const STEP =
  'flex h-9 items-center gap-1 rounded-sm px-2.5 text-body font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'
const PAGE =
  'flex size-9 items-center justify-center rounded-sm text-body font-medium text-foreground tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** The page numbers to show: first, last, and the current one with a neighbour each side. */
function pageSlots(page: number, totalPages: number): PageSlot[] {
  const keep = new Set([1, totalPages, page - 1, page, page + 1])
  const pages = [...keep].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const slots: PageSlot[] = []
  pages.forEach((p, i) => {
    const prev = pages[i - 1]
    if (prev !== undefined && p - prev > 1) slots.push(i === 1 ? 'gap-start' : 'gap-end')
    slots.push(p)
  })
  return slots
}

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
  const slots = pageSlots(page, totalPages)

  return (
    <nav
      aria-label="Pagination"
      className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-border border-t px-4 py-2.5 text-caption font-normal text-muted-foreground"
    >
      <span className="tabular-nums">{tableCopy.showing(from, to, total)}</span>
      <div className="flex items-center gap-4">
        {onPerPageChange ? (
          <div className="hidden items-center gap-2 sm:flex">
            <span>{tableCopy.rowsPerPage}</span>
            {/* Figma "Rows": an outline button, the number then its chevron (owner); 2.25rem like
                the page buttons beside it. The menu lists the choices and closes on pick. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="gap-1.5 px-3 tabular-nums"
                    aria-label={tableCopy.rowsPerPage}
                  />
                }
              >
                {perPage}
                <ChevronDownIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-20">
                <DropdownMenuRadioGroup
                  value={String(perPage)}
                  onValueChange={(v) => onPerPageChange(Number(v))}
                >
                  {siteConfig.ui.rowsPerPage.options.map((n) => (
                    <DropdownMenuRadioItem
                      key={n}
                      value={String(n)}
                      closeOnClick
                      className="tabular-nums"
                    >
                      {n}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={STEP}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={tableCopy.previous}
          >
            <ChevronLeftIcon />
            <span className="hidden sm:inline">{tableCopy.previousLabel}</span>
          </button>
          {slots.map((slot) =>
            typeof slot === 'number' ? (
              <button
                key={slot}
                type="button"
                aria-current={slot === page ? 'page' : undefined}
                onClick={() => onPageChange(slot)}
                className={cn(PAGE, slot === page && 'key-neutral hover:bg-transparent')}
              >
                {slot}
              </button>
            ) : (
              <span
                key={slot}
                aria-hidden="true"
                className="hidden size-9 items-center justify-center text-muted-foreground sm:flex"
              >
                …
              </span>
            ),
          )}
          <button
            type="button"
            className={STEP}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label={tableCopy.next}
          >
            <span className="hidden sm:inline">{tableCopy.nextLabel}</span>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </nav>
  )
}
