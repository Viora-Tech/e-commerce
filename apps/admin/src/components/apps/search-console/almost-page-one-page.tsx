'use client'

import { ALMOST_PAGE_ONE } from '@commerce/core/search-console'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy } from '@/hooks/use-copy'
import ReportFrame from './report-frame'
import SearchPageLabel, { itemHref } from './search-page-label'
import SearchStatsTable from './search-stats-table'

/** Pages Google shows just off page 1 (position 8 to 20) often enough to be worth a push. */
export default function AlmostPageOnePage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)

  // Render logic
  const summary = copy.almostPageOne.summary(
    ALMOST_PAGE_ONE.minImpressions,
    ALMOST_PAGE_ONE.minPosition,
    ALMOST_PAGE_ONE.maxPosition,
  )

  return (
    <ReportFrame title={copy.almostPageOne.title} summary={summary}>
      {(report) => (
        <DataCard title={copy.almostPageOne.title} flush>
          <SearchStatsTable
            first={copy.columns.page}
            empty={copy.almostPageOne.empty}
            withChange={false}
            rows={report.almostPageOne.map((p) => ({
              key: p.key,
              label: (
                <>
                  <SearchPageLabel
                    path={p.key}
                    url={p.url}
                    item={p.item}
                    note={p.topQuery ? `${copy.columns.topSearch}: ${p.topQuery}` : undefined}
                  />
                  {p.item ? (
                    <Link
                      href={itemHref(p.item)}
                      className="text-caption font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {copy.almostPageOne.fix}
                    </Link>
                  ) : null}
                </>
              ),
              stats: p.current,
            }))}
          />
        </DataCard>
      )}
    </ReportFrame>
  )
}
