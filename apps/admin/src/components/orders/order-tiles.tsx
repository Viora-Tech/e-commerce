import { Card } from '@commerce/ui/shadcn/card'
import DeltaChip, { percentDelta } from '@/components/layout/delta-chip'
import { ordersContent } from '@/data/orders'
import type { api } from '@/lib/api-client'

export type OrderStats = Awaited<ReturnType<typeof api.orders.stats>>

type TileProps = {
  title: string
  value: number
  previous: number
  invert?: boolean
}

const number = new Intl.NumberFormat('en-IN')

/* Frame 5:2512: 135px card, 16px inset; title 18/700 with a kebab slot,
   32/700 figure with the delta hanging off its baseline, period line at 100px. */
function Tile({ title, value, previous, invert }: TileProps) {
  return (
    <Card className="h-[6.5rem] gap-0 rounded-lg p-4">
      <p className="text-card-title">{title}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-stat text-ink-strong tabular-nums">{number.format(value)}</span>
        <DeltaChip delta={percentDelta(value, previous)} invert={invert} />
      </div>
      <p className="mt-1.5 text-period text-muted-foreground">{ordersContent.tiles.period}</p>
    </Card>
  )
}

/** The four tiles above the order list (5:2511): 15px apart, equal widths. */
export default function OrderTiles({ stats }: { stats: OrderStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Tile title={ordersContent.tiles.total} {...stats.total} />
      <Tile title={ordersContent.tiles.placed} {...stats.placed} />
      <Tile title={ordersContent.tiles.delivered} {...stats.delivered} />
      <Tile title={ordersContent.tiles.cancelled} {...stats.cancelled} invert />
    </div>
  )
}
