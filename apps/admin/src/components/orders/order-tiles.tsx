import { percentDelta } from '@/components/layout/delta-chip'
import StatStrip, { type StripStat } from '@/components/layout/stat-strip'
import { ordersContent } from '@/data/orders'
import type { api } from '@/lib/api-client'

export type OrderStats = Awaited<ReturnType<typeof api.orders.stats>>

type OrderTilesProps = { stats: OrderStats }

type Count = { value: number; previous: number }

const number = new Intl.NumberFormat('en-IN')

function stat(label: string, count: Count, invert = false): StripStat {
  return {
    label,
    value: number.format(count.value),
    hint: ordersContent.tiles.period,
    delta: percentDelta(count.value, count.previous),
    invert,
  }
}

/** The four order counts for the last seven days, as one quiet strip above the list. */
export default function OrderTiles({ stats }: OrderTilesProps) {
  return (
    <StatStrip
      stats={[
        stat(ordersContent.tiles.total, stats.total),
        stat(ordersContent.tiles.placed, stats.placed),
        stat(ordersContent.tiles.delivered, stats.delivered),
        stat(ordersContent.tiles.cancelled, stats.cancelled, true),
      ]}
    />
  )
}
