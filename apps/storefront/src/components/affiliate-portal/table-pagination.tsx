'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type TablePaginationProps = {
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

const copy = affiliatePortalContent.table
const SIZES = [10, 20, 50] as const

/** dashboard-01's DataTable footer: the row count, rows per page, "Page x of y" and the arrows. */
export default function TablePagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: TablePaginationProps) {
  // Render logic
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between px-4 lg:px-6">
      <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">{copy.rows(total)}</div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            {copy.perPage}
          </Label>
          <NativeSelect
            id="rows-per-page"
            size="sm"
            className="w-20"
            value={String(pageSize)}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {SIZES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {copy.page(page + 1, pages)}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={copy.previous}
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={copy.next}
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
