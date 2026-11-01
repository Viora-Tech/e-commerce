'use client'

import { discoveryRate, type RecommendationStat } from '@commerce/core/discovery'
import KitTable from '@/components/kit/kit-table'
import KitTableHead from '@/components/kit/kit-table-head'
import KitTableRow from '@/components/kit/kit-table-row'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'

type RecommendationStatsTableProps = {
  rows: RecommendationStat[]
}

const COLUMNS = 'minmax(10rem,1fr) 6rem 5rem 6rem 6rem'

/** The recommendation rows' numbers: times seen, clicks, click rate and adds to cart. */
export default function RecommendationStatsTable({ rows }: RecommendationStatsTableProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const fmt = useFormat()

  // Render logic
  const r = copy.overview.recommendations
  const seen = rows.some((row) => row.impressions > 0 || row.clicks > 0)

  return seen ? (
    <div className="overflow-x-auto">
      <KitTable className="min-w-[36rem]">
        <KitTableHead columns={COLUMNS}>
          <span>{r.intent}</span>
          <span className="justify-end">{r.impressions}</span>
          <span className="justify-end">{r.clicks}</span>
          <span className="justify-end">{r.clickRate}</span>
          <span className="justify-end">{r.adds}</span>
        </KitTableHead>
        {rows.map((row) => (
          <KitTableRow key={row.intent} columns={COLUMNS}>
            <span className="font-medium">{copy.overview.intents[row.intent]}</span>
            <span className="justify-end tabular-nums">{fmt.number(row.impressions)}</span>
            <span className="justify-end tabular-nums">{fmt.number(row.clicks)}</span>
            <span className="justify-end tabular-nums">
              {formatRate(discoveryRate(row.clicks, row.impressions))}
            </span>
            <span className="justify-end tabular-nums">{fmt.number(row.adds)}</span>
          </KitTableRow>
        ))}
      </KitTable>
    </div>
  ) : (
    <p className="px-5 py-6 text-body text-muted-foreground">{r.empty}</p>
  )
}
