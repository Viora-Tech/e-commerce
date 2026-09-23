import StatStrip from '@/components/layout/stat-strip'
import { productsListContent } from '@/data/products'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

export type ProductStats = Awaited<ReturnType<typeof api.products.stats>>

type ProductTilesProps = { stats: ProductStats }

const number = new Intl.NumberFormat('en-IN')
const copy = productsListContent.tiles

/** The four catalogue figures above the product list, as one quiet strip. */
export default function ProductTiles({ stats }: ProductTilesProps) {
  return (
    <StatStrip
      stats={[
        { label: copy.total, value: number.format(stats.total), hint: copy.period },
        { label: copy.active, value: number.format(stats.active), hint: copy.period },
        {
          label: copy.outOfStock,
          value: number.format(stats.outOfStock),
          hint: copy.period,
          tone: stats.outOfStock > 0 ? 'critical' : 'default',
        },
        {
          label: copy.stockValue,
          value: formatPaise(stats.stockValuePaise),
          hint: copy.period,
        },
      ]}
    />
  )
}
