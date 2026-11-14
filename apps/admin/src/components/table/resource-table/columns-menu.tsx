'use client'

import { Columns, GripVertical } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import type { ReactTable, RowData } from '@tanstack/react-table'
import { useId, useState } from 'react'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'
import type { ResourceTableFeatures } from './features'

type ColumnsMenuProps<T extends RowData> = {
  table: ReactTable<ResourceTableFeatures, T>
  columnTitles: Record<string, string>
  /** The order the member arranged (empty = as defined). */
  columnOrder: string[]
  /** Back to the page's default columns and order. */
  onReset: () => void
  trigger: string
}

/** The table's own columns (selection and row actions are not choices). */
const FIXED = new Set(['__select', '__actions'])

/**
 * Figma "State · Columns open" (623:17841): "Columns" with Reset, then every column with a drag
 * handle and a checkbox; a column that always shows (Order) is greyed. Dragging a row moves the
 * column in the table.
 */
export default function ColumnsMenu<T extends RowData>({
  table,
  columnTitles,
  columnOrder,
  onReset,
  trigger,
}: ColumnsMenuProps<T>) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  const id = useId()
  const [dragging, setDragging] = useState<string | null>(null)

  // Event handlers
  const handleDrop = (target: string) => {
    if (!dragging || dragging === target) return
    const ids = order.filter((c) => c !== dragging)
    ids.splice(ids.indexOf(target), 0, dragging)
    table.setColumnOrder(['__select', ...ids, '__actions'])
    setDragging(null)
  }

  // Render logic
  const all = table.getAllLeafColumns().filter((c) => !FIXED.has(c.id))
  const saved = columnOrder.filter((c) => !FIXED.has(c))
  const order = saved.length ? saved : all.map((c) => c.id)
  const byId = new Map(all.map((c) => [c.id, c]))

  return (
    <Popover>
      <PopoverTrigger aria-label={tableCopy.toggleColumns} className={cn(trigger, 'size-9')}>
        <Columns />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-64 gap-0 p-0">
        <div className="flex h-11 items-center justify-between border-border border-b px-3.5">
          <p className="text-body font-medium text-ink-strong">{tableCopy.columnsTitle}</p>
          <button
            type="button"
            onClick={onReset}
            className="rounded-sm px-1.5 py-0.5 text-body font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tableCopy.reset}
          </button>
        </div>
        <ul className="flex flex-col p-1.5">
          {order.map((columnId) => {
            const column = byId.get(columnId)
            if (!column) return null
            const fixed = !column.getCanHide()
            return (
              <li
                key={columnId}
                draggable
                onDragStart={() => setDragging(columnId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(columnId)}
                onDragEnd={() => setDragging(null)}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-sm px-1.5 transition-colors hover:bg-muted/60',
                  dragging === columnId && 'opacity-50',
                )}
              >
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                  aria-hidden="true"
                />
                <Checkbox
                  id={`${id}-${columnId}`}
                  checked={column.getIsVisible()}
                  disabled={fixed}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                />
                <label
                  htmlFor={`${id}-${columnId}`}
                  className={cn(
                    'flex-1 text-body',
                    fixed ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {columnTitles[columnId] ?? columnId}
                </label>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
