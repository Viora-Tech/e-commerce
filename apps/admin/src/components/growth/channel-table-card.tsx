import type { ChannelRow } from '@commerce/api'
import { formatNumber } from '@commerce/money'
import { Card } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { CHANNEL_LABELS, growthOverviewContent } from '@/data/growth'
import { formatRate } from '@/lib/analytics-range'
import { formatPaise } from '@/lib/money'

type ChannelTableCardProps = { rows: ChannelRow[] }

const copy = growthOverviewContent.channels

/** Sessions, orders, sales and conversion per channel for the selected range. */
export default function ChannelTableCard({ rows }: ChannelTableCardProps) {
  // Render logic
  const c = copy.columns

  return (
    <Card className="gap-0 p-5">
      <p className="text-kit-title text-foreground">{copy.title}</p>
      {rows.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>{c.channel}</TableHead>
              <TableHead className="text-right">{c.sessions}</TableHead>
              <TableHead className="text-right">{c.orders}</TableHead>
              <TableHead className="text-right">{c.sales}</TableHead>
              <TableHead className="text-right">{c.conversion}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.channel}>
                <TableCell className="font-medium">{CHANNEL_LABELS[row.channel]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.sessions)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.orders)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(row.salesPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.sessions > 0 ? formatRate(row.conversion) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
