'use client'

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
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import type { ResourceTableFeatures } from './features'

// biome-ignore lint/suspicious/noExplicitAny: TanStack's own column arrays are typed with `any` for the value slot.
export type ResourceColumn<T extends RowData> = ColumnDef<ResourceTableFeatures, T, any>

type SortValue = string | number | Date | null

export type ResourceColumnSpec<T extends RowData> = {
  id: string
  title: string
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (item: T) => SortValue | undefined
  align?: 'start' | 'end'
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
    const align = spec.align ?? 'start'
    const meta = { align, className: spec.className }
    if (!spec.sortValue) {
      return helper.display({
        id: spec.id,
        header: () => (
          <span className={cn(align === 'end' && 'block text-right')}>{spec.title}</span>
        ),
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

export function selectionColumn<T extends RowData>(): ResourceColumn<T> {
  const helper = createColumnHelper<ResourceTableFeatures, T>()
  return helper.display({
    id: '__select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label={tableContent.selectAll}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label={tableContent.selectRow}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { align: 'start', className: 'w-8 pr-0' },
  })
}

function PlainHeader({ title, align }: { title: string; align: 'start' | 'end' }) {
  return (
    <span
      className={cn(
        'block text-xs font-medium text-muted-foreground',
        align === 'end' && 'text-right',
      )}
    >
      {title}
    </span>
  )
}

type ColumnHeaderProps<T extends RowData> = {
  column: Column<ResourceTableFeatures, T, SortValue>
  title: string
  align: 'start' | 'end'
}

function ColumnHeader<T extends RowData>({ column, title, align }: ColumnHeaderProps<T>) {
  if (!column.getCanSort()) return <PlainHeader title={title} align={align} />
  const sorted = column.getIsSorted()
  const Icon = sorted === 'desc' ? ArrowDown : sorted === 'asc' ? ArrowUp : ChevronsUpDown

  return (
    <div className={cn('flex items-center', align === 'end' && 'justify-end')}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 gap-1 px-2 text-table-head hover:text-foreground data-open:bg-accent"
            />
          }
        >
          {title}
          <Icon className={cn('size-3.5', sorted && 'text-foreground')} />
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
