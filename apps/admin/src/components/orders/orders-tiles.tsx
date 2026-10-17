'use client'

import StatStrip from '@/components/layout/stat-strip'
import { type OrderListFilter, ordersContent, PENDING_UPI } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { percent } from '@/lib/stats'

export type OrderTilesData = Awaited<ReturnType<typeof api.orders.tiles>>

type OrdersTilesProps = {
  tiles: OrderTilesData
  /** The tab now showing; the tile that matches it lights up. */
  status: OrderListFilter | null
  onSelect: (status: OrderListFilter | null) => void
}

/** The four stat cards above the list (Figma "Stat card"); Ready to ship and Pending UPI filter the table. */
export default function OrdersTiles({ tiles, status, onSelect }: OrdersTilesProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const fmt = useFormat()

  // Render logic
  return (
    <StatStrip
      variant="strip"
      active={status}
      onChange={onSelect}
      tiles={[
        {
          id: 'newToday',
          label: copy.tiles.newToday.label,
          value: fmt.number(tiles.newToday.value),
          trend: percent(tiles.newToday.value, tiles.newToday.previous),
          trendNote: copy.tiles.newToday.trendNote,
        },
        {
          id: 'ready',
          label: copy.tiles.ready.label,
          value: fmt.number(tiles.readyToShip),
          note: copy.tiles.ready.note,
          filter: 'unfulfilled',
        },
        {
          id: 'pendingUpi',
          label: copy.tiles.pendingUpi.label,
          value: fmt.number(tiles.pendingUpi),
          note: copy.tiles.pendingUpi.note,
          filter: PENDING_UPI,
        },
        {
          id: 'sales',
          label: copy.tiles.sales.label,
          value: fmt.money(tiles.salesWeek.paise),
          trend: percent(tiles.salesWeek.paise, tiles.salesWeek.previousPaise),
          trendNote: copy.tiles.sales.trendNote,
        },
      ]}
    />
  )
}
