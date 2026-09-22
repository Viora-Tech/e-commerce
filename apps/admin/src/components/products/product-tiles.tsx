import { Card } from '@commerce/ui/shadcn/card'
import CountUp from '@/components/layout/count-up'
import { productsListContent } from '@/data/products'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

export type ProductStats = Awaited<ReturnType<typeof api.products.stats>>

type ProductTilesProps = { stats: ProductStats }

type TileProps = { title: string; value: string; tone?: 'default' | 'error' }

const number = new Intl.NumberFormat('en-IN')
const copy = productsListContent.tiles

/* Same 135px tile as the order list (5:2512): title 18/700, 32/700 figure, caption under. */
function Tile({ title, value, tone = 'default' }: TileProps) {
  return (
    <Card className="h-[8.4375rem] gap-0 rounded-lg p-4">
      <p className="text-kit-title text-foreground">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        <span
          className={
            tone === 'error'
              ? 'text-kit-stat text-destructive tabular-nums'
              : 'text-kit-stat text-ink-strong tabular-nums'
          }
        >
          <CountUp value={value} />
        </span>
      </div>
      <p className="mt-2 text-kit-body text-muted-foreground">{copy.period}</p>
    </Card>
  )
}

/** The four counts above the product list. */
export default function ProductTiles({ stats }: ProductTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-[0.9375rem] xl:grid-cols-4">
      <Tile title={copy.total} value={number.format(stats.total)} />
      <Tile title={copy.active} value={number.format(stats.active)} />
      <Tile
        title={copy.outOfStock}
        value={number.format(stats.outOfStock)}
        tone={stats.outOfStock > 0 ? 'error' : 'default'}
      />
      <Tile title={copy.stockValue} value={formatPaise(stats.stockValuePaise)} />
    </div>
  )
}
