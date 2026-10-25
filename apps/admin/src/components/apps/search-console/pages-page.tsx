'use client'

import DataCard from '@/components/layout/data-card'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy } from '@/hooks/use-copy'
import ReportFrame from './report-frame'
import SearchPageLabel from './search-page-label'
import SearchStatsTable from './search-stats-table'

/** Top pages: the store's pages on Google, matched to its products, collections and pages. */
export default function PagesPage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)

  // Render logic
  return (
    <ReportFrame title={copy.pages.title} summary={copy.pages.summary}>
      {(report) => (
        <DataCard title={copy.pages.title} flush>
          <SearchStatsTable
            first={copy.columns.page}
            empty={copy.pages.empty}
            rows={report.pages.map((p) => ({
              key: p.key,
              label: (
                <SearchPageLabel
                  path={p.key}
                  url={p.url}
                  item={p.item}
                  note={p.topQuery ? `${copy.columns.topSearch}: ${p.topQuery}` : undefined}
                />
              ),
              stats: p.current,
              change: p.clickChange,
            }))}
          />
        </DataCard>
      )}
    </ReportFrame>
  )
}
