import { cn } from '@commerce/ui/lib/utils'
import {
  Table,
  TableBody,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'
import { HEAD, SIMPLE_BODY } from './resource-table/styles'

export type SimpleTableColumn = {
  key: string
  /** The header text; a node for a screen-reader-only label (`<span className="sr-only">`). */
  label: ReactNode
  align?: 'start' | 'center' | 'end'
  /** Width or visibility classes, e.g. `w-32` or `hidden md:table-cell`. */
  className?: string
}

type SimpleTableProps = {
  columns: SimpleTableColumn[]
  /** The body rows: `TableRow`s (or `LinkRow`s) of `TableCell`s from `@commerce/ui/shadcn/table`. */
  children: ReactNode
  /**
   * `list` (default): the list table's 3.75rem rows. `compact`: 2.5rem rows, for a small table in
   * a popup, a popover or a statement card.
   */
  density?: keyof typeof SIMPLE_BODY
  /** Footer rows (`TableRow`s), e.g. a total. */
  footer?: ReactNode
  /** Classes for the `<table>`, e.g. `min-w-[36rem]` so it scrolls sideways on a phone. */
  className?: string
  /** Read out for the table when no heading above names it. */
  label?: string
}

const ALIGN = { start: 'text-left', center: 'text-center', end: 'text-right' } as const

/**
 * A small fixed table (an app's report, a breakdown, a card's few rows) drawn like the main lists
 * (`ResourceTable`): the same 2.5rem header with 0.75rem muted labels, the same row height and
 * sides, hairlines between rows. It scrolls sideways when it is wider than the card. Real lists
 * with search, paging or selection use `ResourceTable` instead.
 */
export default function SimpleTable({
  columns,
  children,
  density = 'list',
  footer,
  className,
  label,
}: SimpleTableProps) {
  // Render logic
  return (
    <Table
      aria-label={label}
      className={cn(
        '[&_tbody_tr]:border-b [&_tbody_tr]:border-border',
        SIMPLE_BODY[density],
        className,
      )}
    >
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c) => (
            <TableHead key={c.key} className={cn(HEAD, ALIGN[c.align ?? 'start'], c.className)}>
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
      {footer ? <TableFooter>{footer}</TableFooter> : null}
    </Table>
  )
}
