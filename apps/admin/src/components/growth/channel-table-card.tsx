'use client'

import type { ChannelRow } from '@commerce/api'
import { type ChannelFilter, channelMatches } from '@commerce/core/marketing'
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
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { CHANNEL_LABELS, growthOverviewContent } from '@/data/growth'
import { growthSplitContent } from '@/data/growth-report'
import { useCopy } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { formatPaise } from '@/lib/money'
import SplitCell from './split-cell'

type ChannelTableCardProps = { rows: ChannelRow[] }

const FILTERS: ChannelFilter[] = ['all', 'paid', 'organic']

/**
 * Sessions, orders, sales (first-time vs returning) and conversion per channel for the
 * selected range, narrowed to paid or organic channels with the filter.
 */
export default function ChannelTableCard({ rows }: ChannelTableCardProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent.channels)
  const split = useCopy(growthSplitContent)
  const [filter, setFilter] = useState<ChannelFilter>('all')

  // Event handlers
  const handleFilter = (next: string[]) => {
    const picked = FILTERS.find((f) => f === next[0])
    if (picked) setFilter(picked)
  }

  // Render logic
  const c = copy.columns
  const shown = rows.filter((row) => channelMatches(row.channel, filter))

  return (
    <Card gap="none" inset={5}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-kit-title text-foreground">{copy.title}</p>
        {rows.length > 0 ? (
          <ToggleGroup
            value={[filter]}
            onValueChange={handleFilter}
            aria-label={split.filter.label}
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f}>
                {split.filter[f]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{copy.empty}</p>
      ) : shown.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{split.filter.empty}</p>
      ) : (
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>{c.channel}</TableHead>
              <TableHead className="text-right">{c.sessions}</TableHead>
              <TableHead className="text-right">{c.orders}</TableHead>
              <TableHead className="text-right">{c.sales}</TableHead>
              <TableHead className="text-right">{split.newBuyers}</TableHead>
              <TableHead className="text-right">{split.returning}</TableHead>
              <TableHead className="text-right">{c.conversion}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
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
                <TableCell className="text-right">
                  <SplitCell salesPaise={row.split.newSalesPaise} orders={row.split.newOrders} />
                </TableCell>
                <TableCell className="text-right">
                  <SplitCell
                    salesPaise={row.split.returningSalesPaise}
                    orders={row.split.returningOrders}
                  />
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
