import { Card } from '@commerce/ui/shadcn/card'
import { customersContent } from '@/data/customers'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

export type CustomerStats = Awaited<ReturnType<typeof api.customers.stats>>

type TileProps = {
  title: string
  value: string
  period: string
}

const number = new Intl.NumberFormat('en-IN')

/* Same tile as the order list (frame 5:2512): title, figure, period line. Customer
   counts are stocks, not flows, so there is no previous window to compare against. */
function Tile({ title, value, period }: TileProps) {
  return (
    <Card className="h-[6.5rem] gap-0 rounded-lg p-4">
      <p className="text-card-title">{title}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-stat text-ink-strong tabular-nums">{value}</span>
      </div>
      <p className="mt-1.5 text-period text-muted-foreground">{period}</p>
    </Card>
  )
}

/** The four tiles above the customer list. */
export default function CustomerTiles({ stats }: { stats: CustomerStats }) {
  // Render logic
  const t = customersContent.tiles

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Tile title={t.total} value={number.format(stats.total)} period={t.allTime} />
      <Tile title={t.newThisMonth} value={number.format(stats.newThisMonth)} period={t.period} />
      <Tile title={t.returning} value={number.format(stats.returning)} period={t.allTime} />
      <Tile title={t.average} value={formatPaise(stats.averageLifetimePaise)} period={t.allTime} />
    </div>
  )
}
