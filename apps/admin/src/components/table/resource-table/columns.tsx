'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import {
  type Column,
  type ColumnDef,
  createColumnHelper,
  type RowData,
} from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import type { ResourceTableFeatures } from './features'

// biome-ignore lint/suspicious/noExplicitAny: TanStack's own column arrays are typed with `any` for the value slot.
export type ResourceColumn<T extends RowData> = ColumnDef<ResourceTableFeatures, T, any>

type SortValue = string | number | Date | null

export type CellAlign = 'start' | 'center' | 'end'

export type ResourceColumnSpec<T extends RowData> = {
  id: string
  title: string
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (item: T) => SortValue | undefined
  /** Frame 5:2591 centres every column; product-style cells pass `start`. */
  align?: CellAlign
  /** `false` keeps the column out of the "View" toggle. */
  hideable?: boolean
  /** Tailwind width/utility classes for both header and cells. */
  className?: string
  render: (item: T) => ReactNode
}

/**
 * Turn a plain column spec into TanStack column defs. Pages describe what to
 * show; the table decides how headers, sorting and selection render.
 */
export function defineColumns<T extends RowData>(
  specs: ResourceColumnSpec<T>[],
): ResourceColumn<T>[] {
  const helper = createColumnHelper<ResourceTableFeatures, T>()
  return specs.map((spec) => {
    const align = spec.align ?? 'center'
    const meta = { align, className: spec.className }
    if (!spec.sortValue) {
      return helper.display({
        id: spec.id,
        header: () => <PlainHeader title={spec.title} align={align} />,
        cell: ({ row }) => spec.render(row.original),
        enableSorting: false,
        enableHiding: spec.hideable ?? true,
        meta,
      })
    }
    const sortValue = spec.sortValue
    return helper.accessor((item) => sortValue(item) ?? null, {
      id: spec.id,
      header: ({ column }) => <ColumnHeader column={column} title={spec.title} align={align} />,
      cell: ({ row }) => spec.render(row.original),
      enableSorting: true,
      enableHiding: spec.hideable ?? true,
      sortFn: 'basic',
      meta,
    })
  })
}

/** Frame 5:2607: the "No." column is a 20px checkbox and the row number, 44px wide. */
export function selectionColumn<T extends RowData>(offset: number): ResourceColumn<T> {
  const helper = createColumnHelper<ResourceTableFeatures, T>()
  return helper.display({
    id: '__select',
    header: ({ table }) => (
      <span className="flex items-center gap-2">
        <Checkbox
          className="size-4 border-primary-soft bg-card"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={tableContent.selectAll}
        />
        {tableContent.number}
      </span>
    ),
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <Checkbox
          className="size-4 border-primary-soft bg-card"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label={tableContent.selectRow}
        />
        <span className="tabular-nums">{offset + row.index + 1}</span>
      </span>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { align: 'start', className: 'w-14' },
  })
}

const HEAD_ALIGN: Record<CellAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
}

function PlainHeader({ title, align }: { title: string; align: CellAlign }) {
  return <span className={cn('flex items-center', HEAD_ALIGN[align])}>{title}</span>
}

type ColumnHeaderProps<T extends RowData> = {
  column: Column<ResourceTableFeatures, T, SortValue>
  title: string
  align: CellAlign
}

function ColumnHeader<T extends RowData>({ column, title, align }: ColumnHeaderProps<T>) {
  if (!column.getCanSort()) return <PlainHeader title={title} align={align} />
  const sorted = column.getIsSorted()
  const Icon = sorted === 'desc' ? ArrowDown : sorted === 'asc' ? ArrowUp : ChevronsUpDown

  return (
    <div className={cn('flex items-center', HEAD_ALIGN[align])}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1 font-[number:inherit] text-[length:inherit] text-ink-strong leading-[inherit] hover:bg-transparent hover:text-primary data-open:bg-transparent"
            />
          }
        >
          {title}
          <Icon className={cn('size-3.5 text-muted-foreground', sorted && 'text-primary')} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align === 'end' ? 'end' : 'start'}>
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp />
            {tableContent.sortAsc}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown />
            {tableContent.sortDesc}
          </DropdownMenuItem>
          {column.getCanHide() ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff />
                {tableContent.hideColumn}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
