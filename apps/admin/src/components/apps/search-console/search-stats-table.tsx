'use client'

import type { SearchStats } from '@commerce/core/search-console'
import type { ReactNode } from 'react'
import KitTable from '@/components/kit/kit-table'
import KitTableHead from '@/components/kit/kit-table-head'
import KitTableRow from '@/components/kit/kit-table-row'
import DeltaChip from '@/components/layout/delta-chip'
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

const COLUMNS = 'minmax(12rem,1fr) 5rem 6rem 6rem 5.5rem'
const COLUMNS_WITH_CHANGE = `${COLUMNS} 6rem`

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
  const columns = withChange ? COLUMNS_WITH_CHANGE : COLUMNS

  return (
    <div className="overflow-x-auto">
      <KitTable className="min-w-[44rem]">
        <KitTableHead columns={columns}>
          <span>{first}</span>
          <span className="justify-end">{copy.columns.clicks}</span>
          <span className="justify-end">{copy.columns.views}</span>
          <span className="justify-end">{copy.columns.ctr}</span>
          <span className="justify-end">{copy.columns.position}</span>
          {withChange ? <span className="justify-end">{copy.columns.change}</span> : null}
        </KitTableHead>
        {rows.map((row) => (
          <KitTableRow key={row.key} columns={columns}>
            <div className="flex-col items-start! gap-0.5">{row.label}</div>
            <span className="justify-end tabular-nums">{fmt.number(row.stats.clicks)}</span>
            <span className="justify-end tabular-nums">{fmt.number(row.stats.impressions)}</span>
            <span className="justify-end tabular-nums">{formatRate(row.stats.ctr)}</span>
            <span className="justify-end tabular-nums">{row.stats.position.toFixed(1)}</span>
            {withChange ? (
              <span className="justify-end">
                <DeltaChip delta={row.change ?? null} />
              </span>
            ) : null}
          </KitTableRow>
        ))}
      </KitTable>
    </div>
  )
}
