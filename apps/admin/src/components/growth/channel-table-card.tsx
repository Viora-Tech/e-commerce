'use client'

import type { ChannelRow } from '@commerce/api'
import { type ChannelFilter, channelMatches } from '@commerce/core/marketing'
import { formatNumber } from '@commerce/money'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import SimpleTable from '@/components/table/simple-table'
import { CHANNEL_LABELS, growthOverviewContent } from '@/data/growth'
import { growthSplitContent } from '@/data/growth-report'
import { useCopy } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { formatPaiseWhole } from '@/lib/money'
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
    <DataCard
      title={copy.title}
      flush={shown.length > 0}
      action={
        rows.length > 0 ? (
          <ToggleGroup
            variant="segmented"
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
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : shown.length === 0 ? (
        <EmptyState variant="inline" body={split.filter.empty} />
      ) : (
        <SimpleTable
          className="min-w-[44rem]"
          columns={[
            { key: 'channel', label: c.channel },
            { key: 'sessions', label: c.sessions, align: 'end' },
            { key: 'orders', label: c.orders, align: 'end' },
            { key: 'sales', label: c.sales, align: 'end' },
            { key: 'new', label: split.newBuyers, align: 'end' },
            { key: 'returning', label: split.returning, align: 'end' },
            { key: 'conversion', label: c.conversion, align: 'end' },
          ]}
        >
          {shown.map((row) => (
            <TableRow key={row.channel}>
              <TableCell className="font-medium">{CHANNEL_LABELS[row.channel]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(row.sessions)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.orders)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPaiseWhole(row.salesPaise)}
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
        </SimpleTable>
      )}
    </DataCard>
  )
}
