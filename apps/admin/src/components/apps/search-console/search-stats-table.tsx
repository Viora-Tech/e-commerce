'use client'

import type { SearchStats } from '@commerce/core/search-console'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'
import DeltaChip from '@/components/layout/delta-chip'
import SimpleTable, { type SimpleTableColumn } from '@/components/table/simple-table'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'

export type SearchStatsRow = {
  key: string
  /** The search, or the page's title and path. */
  label: ReactNode
  stats: SearchStats
  /** Percent change in clicks against the 28 days before; omitted hides the column. */
  change?: number | null
}

type SearchStatsTableProps = {
  /** Heading of the first column: "Search" or "Page". */
  first: string
  rows: SearchStatsRow[]
  empty: string
  /** Show the "Change" column. */
  withChange?: boolean
}

/** A ranked table of Google numbers: clicks, views, click rate, position and the change in clicks. */
export default function SearchStatsTable({
  first,
  rows,
  empty,
  withChange = true,
}: SearchStatsTableProps) {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()

  // Early returns
  if (rows.length === 0) return <p className="py-6 text-body text-muted-foreground">{empty}</p>

  // Render logic
  const columns: SimpleTableColumn[] = [
    { key: 'label', label: first },
    { key: 'clicks', label: copy.columns.clicks, align: 'end', className: 'w-20' },
    { key: 'views', label: copy.columns.views, align: 'end', className: 'w-24' },
    { key: 'ctr', label: copy.columns.ctr, align: 'end', className: 'w-24' },
    { key: 'position', label: copy.columns.position, align: 'end', className: 'w-22' },
    ...(withChange
      ? [{ key: 'change', label: copy.columns.change, align: 'end' as const, className: 'w-24' }]
      : []),
  ]

  return (
    <SimpleTable className="min-w-[44rem]" columns={columns}>
      {rows.map((row) => (
        <TableRow key={row.key}>
          <TableCell className="whitespace-normal">
            <div className="flex flex-col items-start gap-0.5">{row.label}</div>
          </TableCell>
          <TableCell className="text-right tabular-nums">{fmt.number(row.stats.clicks)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {fmt.number(row.stats.impressions)}
          </TableCell>
          <TableCell className="text-right tabular-nums">{formatRate(row.stats.ctr)}</TableCell>
          <TableCell className="text-right tabular-nums">{row.stats.position.toFixed(1)}</TableCell>
          {withChange ? (
            <TableCell className="text-right">
              <DeltaChip delta={row.change ?? null} />
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </SimpleTable>
  )
}
