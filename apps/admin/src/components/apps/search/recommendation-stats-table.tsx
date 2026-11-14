'use client'

import { discoveryRate, type RecommendationStat } from '@commerce/core/discovery'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import SimpleTable from '@/components/table/simple-table'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'

type RecommendationStatsTableProps = {
  rows: RecommendationStat[]
}

/** The recommendation rows' numbers: times seen, clicks, click rate and adds to cart. */
export default function RecommendationStatsTable({ rows }: RecommendationStatsTableProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const fmt = useFormat()

  // Render logic
  const r = copy.overview.recommendations
  const seen = rows.some((row) => row.impressions > 0 || row.clicks > 0)

  return seen ? (
    <SimpleTable
      className="min-w-[36rem]"
      columns={[
        { key: 'intent', label: r.intent },
        { key: 'impressions', label: r.impressions, align: 'end', className: 'w-24' },
        { key: 'clicks', label: r.clicks, align: 'end', className: 'w-20' },
        { key: 'rate', label: r.clickRate, align: 'end', className: 'w-24' },
        { key: 'adds', label: r.adds, align: 'end', className: 'w-24' },
      ]}
    >
      {rows.map((row) => (
        <TableRow key={row.intent}>
          <TableCell className="font-medium">{copy.overview.intents[row.intent]}</TableCell>
          <TableCell className="text-right tabular-nums">{fmt.number(row.impressions)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmt.number(row.clicks)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatRate(discoveryRate(row.clicks, row.impressions))}
          </TableCell>
          <TableCell className="text-right tabular-nums">{fmt.number(row.adds)}</TableCell>
        </TableRow>
      ))}
    </SimpleTable>
  ) : (
    <p className="px-5 py-6 text-body text-muted-foreground">{r.empty}</p>
  )
}
