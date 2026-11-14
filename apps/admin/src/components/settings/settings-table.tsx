'use client'

import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import SimpleTable from '@/components/table/simple-table'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

export type SettingsTableColumn = {
  label: string
  /** Centre the column (status chips). */
  center?: boolean
  /** Extra classes, e.g. `hidden md:table-cell` on the head and its cells. */
  className?: string
}

type SettingsTableProps = {
  columns: SettingsTableColumn[]
  /** Rows made of `SettingsTableRow`. */
  children: ReactNode
  /** Number of rows, for the "Showing 1–n of n" footer. Leave out to hide the footer. */
  total?: number
  /** A section title above the grid inside the card. */
  heading?: string
  /** The plain-words line under the heading. */
  description?: string
  /** Adds the empty trailing column for row actions. */
  actions?: boolean
  /** Content under the grid (an empty state) inside the same card. */
  after?: ReactNode
  /** Card actions under the grid ("Add a delivery area"), right-aligned like every card footer. */
  footer?: ReactNode
}

/** Body cell classes, for rows that pass them to `TableCell` (or use `SettingsTableCell`). The
 *  row height and sides come from `SimpleTable`. */
export const SETTINGS_CELL = 'text-body'

/**
 * A short table inside a card, for settings lists (team, domains, zones, messages): a `DataCard`
 * with the card title and a `SimpleTable`, so the header and rows match the main lists.
 */
export default function SettingsTable({
  columns,
  children,
  total,
  heading,
  description,
  actions = false,
  after,
  footer,
}: SettingsTableProps) {
  // Hooks
  const copy = useCopy(tableContent)

  // Render logic
  const tableColumns = [
    ...columns.map((c, i) => ({
      key: `${i.toString()}-${c.label}`,
      label: c.label,
      align: c.center ? ('center' as const) : ('start' as const),
      className: c.className,
    })),
    ...(actions ? [{ key: 'actions', label: '', className: 'w-16' }] : []),
  ]

  return (
    <DataCard title={heading} subtitle={description} footer={footer} className="h-auto" flush>
      <SimpleTable columns={tableColumns}>{children}</SimpleTable>
      {after}
      {total === undefined || total === 0 ? null : (
        <p className="px-5 pt-3 text-caption text-muted-foreground">
          {copy.showing(1, total, total)}
        </p>
      )}
    </DataCard>
  )
}
