import { Card } from '@commerce/ui/shadcn/card'
import DeltaChip, { percentDelta } from '@/components/layout/delta-chip'
import { ordersContent } from '@/data/orders'
import type { api } from '@/lib/api-client'

export type OrderStats = Awaited<ReturnType<typeof api.orders.stats>>

type OrderTilesProps = { stats: OrderStats }

type TileProps = {
  title: string
  value: number
  previous: number
  invert?: boolean
}

const number = new Intl.NumberFormat('en-IN')

/* Frame 5:2512: 135px card, 16px inset; title 18/700 line 26, 32/700 figure
   with the delta hanging off its baseline, "Last 7 days" 13px at y=100. */
function Tile({ title, value, previous, invert }: TileProps) {
  return (
    <Card className="h-[8.4375rem] gap-0 rounded-lg p-4">
      <p className="text-kit-title text-foreground">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-kit-stat text-ink-strong tabular-nums">{number.format(value)}</span>
        <span className="pb-1">
          <DeltaChip delta={percentDelta(value, previous)} invert={invert} />
        </span>
      </div>
      <p className="mt-2 text-kit-body text-muted-foreground">{ordersContent.tiles.period}</p>
    </Card>
  )
}

/** The four tiles above the order list (5:2511): 15px apart, equal widths. */
export default function OrderTiles({ stats }: OrderTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-[0.9375rem] xl:grid-cols-4">
      <Tile title={ordersContent.tiles.total} {...stats.total} />
      <Tile title={ordersContent.tiles.placed} {...stats.placed} />
      <Tile title={ordersContent.tiles.delivered} {...stats.delivered} />
      <Tile title={ordersContent.tiles.cancelled} {...stats.cancelled} invert />
    </div>
  )
}
