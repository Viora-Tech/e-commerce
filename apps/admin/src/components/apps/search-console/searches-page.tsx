'use client'

import DataCard from '@/components/layout/data-card'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy } from '@/hooks/use-copy'
import ReportFrame from './report-frame'
import SearchStatsTable from './search-stats-table'

/** Top searches: what people typed on Google before they saw the store, most clicks first. */
export default function SearchesPage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)

  // Render logic
  return (
    <ReportFrame title={copy.searches.title} summary={copy.searches.summary}>
      {(report) => (
        <DataCard title={copy.searches.title} flush>
          <SearchStatsTable
            first={copy.columns.search}
            empty={copy.searches.empty}
            rows={report.queries.map((q) => ({
              key: q.key,
              label: <span className="truncate font-medium text-foreground">{q.key}</span>,
              stats: q.current,
              change: q.clickChange,
            }))}
          />
        </DataCard>
      )}
    </ReportFrame>
  )
}
