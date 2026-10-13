'use client'

import type { ReactNode } from 'react'
import KitTable from '@/components/kit/kit-table'
import KitTableHead from '@/components/kit/kit-table-head'
import KitTableRow from '@/components/kit/kit-table-row'
import DataCard from '@/components/layout/data-card'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import ReportFrame from './report-frame'
import SearchPageLabel from './search-page-label'

const COLUMNS = 'minmax(12rem,1fr) 6rem 6rem 7rem'

type Drop = { key: string; label: ReactNode; before: number; now: number; lost: number }

/** Pages and searches with fewer Google clicks than in the 28 days before, biggest drop first. */
export default function LosingTrafficPage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()

  // Helpers
  const table = (first: string, rows: Drop[], empty: string) =>
    rows.length === 0 ? (
      <p className="py-6 text-body text-muted-foreground">{empty}</p>
    ) : (
      <div className="overflow-x-auto">
        <KitTable className="min-w-[36rem]">
          <KitTableHead columns={COLUMNS}>
            <span>{first}</span>
            <span className="justify-end">{copy.columns.before}</span>
            <span className="justify-end">{copy.columns.now}</span>
            <span className="justify-end">{copy.columns.lost}</span>
          </KitTableHead>
          {rows.map((row) => (
            <KitTableRow key={row.key} columns={COLUMNS}>
              <div className="flex-col items-start! gap-0.5">{row.label}</div>
              <span className="justify-end tabular-nums">{fmt.number(row.before)}</span>
              <span className="justify-end tabular-nums">{fmt.number(row.now)}</span>
              <span className="justify-end font-medium text-destructive tabular-nums">
                −{fmt.number(row.lost)}
              </span>
            </KitTableRow>
          ))}
        </KitTable>
      </div>
    )

  // Render logic
  return (
    <ReportFrame title={copy.losing.title} summary={copy.losing.summary}>
      {(report) => (
        <>
          <DataCard title={copy.losing.pages} flush>
            {table(
              copy.columns.page,
              report.losingPages.map((p) => ({
                key: p.key,
                label: <SearchPageLabel path={p.key} url={p.url} item={p.item} />,
                before: p.previous.clicks,
                now: p.current.clicks,
                lost: -p.clickDelta,
              })),
              copy.losing.emptyPages,
            )}
          </DataCard>
          <DataCard title={copy.losing.searches} flush>
            {table(
              copy.columns.search,
              report.losingQueries.map((q) => ({
                key: q.key,
                label: <span className="truncate font-medium text-foreground">{q.key}</span>,
                before: q.previous.clicks,
                now: q.current.clicks,
                lost: -q.clickDelta,
              })),
              copy.losing.emptySearches,
            )}
          </DataCard>
        </>
      )}
    </ReportFrame>
  )
}
