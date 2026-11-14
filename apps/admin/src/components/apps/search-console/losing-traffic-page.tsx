'use client'

import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import SimpleTable from '@/components/table/simple-table'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import ReportFrame from './report-frame'
import SearchPageLabel from './search-page-label'

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
      <SimpleTable
        className="min-w-[36rem]"
        columns={[
          { key: 'label', label: first },
          { key: 'before', label: copy.columns.before, align: 'end', className: 'w-24' },
          { key: 'now', label: copy.columns.now, align: 'end', className: 'w-24' },
          { key: 'lost', label: copy.columns.lost, align: 'end', className: 'w-28' },
        ]}
      >
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="whitespace-normal">
              <div className="flex flex-col items-start gap-0.5">{row.label}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{fmt.number(row.before)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt.number(row.now)}</TableCell>
            <TableCell className="text-right font-medium text-destructive tabular-nums">
              −{fmt.number(row.lost)}
            </TableCell>
          </TableRow>
        ))}
      </SimpleTable>
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
