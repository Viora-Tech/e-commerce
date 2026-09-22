import { Card } from '@commerce/ui/shadcn/card'
import { discountsContent } from '@/data/discounts'
import type { api } from '@/lib/api-client'

export type DiscountStats = Awaited<ReturnType<typeof api.discounts.stats>>

type TileProps = {
  title: string
  value: number
  period: string
}

const number = new Intl.NumberFormat('en-IN')

/* Same tile as the order list (frame 5:2512): title, figure, period line. */
function Tile({ title, value, period }: TileProps) {
  return (
    <Card className="h-[6.5rem] gap-0 rounded-lg p-4">
      <p className="text-card-title">{title}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-stat text-ink-strong tabular-nums">{number.format(value)}</span>
      </div>
      <p className="mt-1.5 text-period text-muted-foreground">{period}</p>
    </Card>
  )
}

/** The four tiles above the discount list. */
export default function DiscountTiles({ stats }: { stats: DiscountStats }) {
  const t = discountsContent.tiles
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Tile title={t.active} value={stats.active} period={t.now} />
      <Tile title={t.scheduled} value={stats.scheduled} period={t.now} />
      <Tile title={t.expired} value={stats.expired} period={t.now} />
      <Tile title={t.usedThisMonth} value={stats.usedThisMonth} period={t.month} />
    </div>
  )
}
