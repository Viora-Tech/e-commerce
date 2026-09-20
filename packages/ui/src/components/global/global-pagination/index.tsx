'use client'

import type { HTMLAttributes } from 'react'
import type { GlobalPaginationProps } from '../../../lib/pagination'
import { cn } from '../../../lib/utils'
import { Button } from '../../shadcn/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shadcn/select'
import IconComponent from '../icon-component'

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]

export function GlobalPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onPrevious,
  onNext,
  className = '',
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  variant = 'default',
  ...rest
}: GlobalPaginationProps & HTMLAttributes<HTMLDivElement>) {
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems)

  const renderPageItems = () => {
    const items: (number | 'ellipsis-start' | 'ellipsis-end')[] = []

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) items.push(i)
      return items
    }

    items.push(1)

    if (currentPage <= 3) {
      items.push(2, 3, 4, 'ellipsis-end', totalPages)
    } else if (currentPage >= totalPages - 2) {
      items.push('ellipsis-start', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      items.push(
        'ellipsis-start',
        currentPage - 1,
        currentPage,
        currentPage + 1,
        'ellipsis-end',
        totalPages,
      )
    }

    return items
  }

  const pageItems = renderPageItems()

  const resolvedPageSizeOptions = pageSizeOptions.includes(itemsPerPage)
    ? pageSizeOptions
    : [...pageSizeOptions, itemsPerPage].sort((a, b) => a - b)

  const renderPageSizeSelect = () => {
    if (!onPageSizeChange) return null

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Per Page:</span>
        <Select
          onValueChange={(value) => onPageSizeChange(Number(value))}
          value={String(itemsPerPage)}
        >
          <SelectTrigger className="h-8 w-20 rounded-xl bg-secondary text-sm transition-colors hover:bg-secondary/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[280px] bg-background">
            {resolvedPageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  const renderPageButtons = () =>
    pageItems.map((item) =>
      typeof item === 'string' ? (
        <IconComponent className="size-4 text-muted-foreground" icon="MoreHorizontal" key={item} />
      ) : (
        <Button
          className={cn(
            'h-8 min-w-8 rounded-xl px-3 text-xs font-medium',
            item === currentPage ? 'bg-secondary shadow-sm' : 'bg-background opacity-50',
          )}
          key={item}
          onClick={() => onPageChange(item)}
          size="icon"
          variant={item === currentPage ? 'secondary' : 'ghost'}
        >
          {item}
        </Button>
      ),
    )

  if (variant === 'topic') {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-4', className)} {...rest}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            Showing results {endIndex} of {totalItems}
          </span>
          {renderPageSizeSelect()}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-4">
            <Button
              className="h-8 gap-2 rounded-xl bg-background px-3"
              disabled={currentPage === 1}
              onClick={onPrevious}
              variant="ghost"
            >
              <IconComponent className="size-5" icon="ChevronLeft" />
              <span className="text-xs font-medium">Previous</span>
            </Button>

            <div className="flex items-center gap-1">{renderPageButtons()}</div>

            <Button
              className="h-8 gap-2 rounded-xl bg-background px-3"
              disabled={currentPage === totalPages}
              onClick={onNext}
              variant="ghost"
            >
              <span className="text-xs font-medium">Next</span>
              <IconComponent className="size-4" icon="ChevronRight" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Default variant:
  // Left:  < Previous | 1 2 3 4 ··· 50 | Next >
  // Right: Showing results X of Y | Per Page: [10 ▾]
  return (
    <div className={cn('flex items-center justify-between', className)} {...rest}>
      {totalPages > 1 ? (
        <div className="flex items-center gap-4">
          <Button
            className="h-8 gap-2 rounded-xl bg-background px-3"
            disabled={currentPage === 1}
            onClick={onPrevious}
            variant="ghost"
          >
            <IconComponent className="size-4" icon="ChevronLeft" />
            <span className="text-xs font-medium">Previous</span>
          </Button>

          <div className="flex items-center gap-1">{renderPageButtons()}</div>

          <Button
            className="h-8 gap-2 rounded-xl bg-background px-3"
            disabled={currentPage === totalPages}
            onClick={onNext}
            variant="ghost"
          >
            <span className="text-xs font-medium">Next</span>
            <IconComponent className="size-4" icon="ChevronRight" />
          </Button>
        </div>
      ) : (
        <div />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">
          Showing results {endIndex} of {totalItems}
        </span>
        {renderPageSizeSelect()}
      </div>
    </div>
  )
}
