'use client'

import StatTile from '@/components/layout/stat-tile'
import { type OrderListFilter, ordersContent, PENDING_UPI } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type OrderTilesData = Awaited<ReturnType<typeof api.orders.tiles>>

type OrdersTilesProps = {
  tiles: OrderTilesData
  /** The tab now showing; the tile that matches it lights up. */
  status: OrderListFilter | null
  onSelect: (status: OrderListFilter | null) => void
}

/** Percent change, or null when there is nothing to compare with (a first day or week). */
function percent(value: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((value - previous) / previous) * 100)
}

/** The four stat cards above the list (Figma "Stat card"); Ready to ship and Pending UPI filter the table. */
export default function OrdersTiles({ tiles, status, onSelect }: OrdersTilesProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const fmt = useFormat()

  // Event handlers
  const handlePick = (next: OrderListFilter) => onSelect(status === next ? null : next)

  return (
    <>
      <StatTile
        label={copy.tiles.newToday.label}
        value={fmt.number(tiles.newToday.value)}
        trend={percent(tiles.newToday.value, tiles.newToday.previous)}
        trendNote={copy.tiles.newToday.trendNote}
      />
      <StatTile
        label={copy.tiles.ready.label}
        value={fmt.number(tiles.readyToShip)}
        note={copy.tiles.ready.note}
        onSelect={() => handlePick('unfulfilled')}
        active={status === 'unfulfilled'}
      />
      <StatTile
        label={copy.tiles.pendingUpi.label}
        value={fmt.number(tiles.pendingUpi)}
        note={copy.tiles.pendingUpi.note}
        onSelect={() => handlePick(PENDING_UPI)}
        active={status === PENDING_UPI}
      />
      <StatTile
        label={copy.tiles.sales.label}
        value={fmt.money(tiles.salesWeek.paise)}
        trend={percent(tiles.salesWeek.paise, tiles.salesWeek.previousPaise)}
        trendNote={copy.tiles.sales.trendNote}
      />
    </>
  )
}
