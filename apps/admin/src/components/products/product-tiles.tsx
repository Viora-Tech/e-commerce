'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import StatTile from '@/components/layout/stat-tile'
import { productsListContent } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { StockFilter } from './product-filters'

type ProductTilesProps = {
  stats: { total: number; draft: number; lowStock: number; outOfStock: number }
  stock: StockFilter | null
  status: ProductStatus | null
  /** Picks what the tile filters to; a tile that is already on clears itself. */
  onSelect: (patch: { stock?: StockFilter; status?: ProductStatus }) => void
}

/** The four stat tiles over the product list; each one filters the table below. */
export default function ProductTiles({ stats, stock, status, onSelect }: ProductTilesProps) {
  // Hooks
  const { tiles } = useCopy(productsListContent)
  const fmt = useFormat()

  // Render logic
  const none = stock === null && status === null

  return (
    <>
      <StatTile
        label={tiles.total}
        value={fmt.number(stats.total)}
        active={none}
        onSelect={() => onSelect({})}
      />
      <StatTile
        label={tiles.low}
        value={fmt.number(stats.lowStock)}
        active={stock === 'low'}
        onSelect={() => onSelect(stock === 'low' ? {} : { stock: 'low' })}
      />
      <StatTile
        label={tiles.out}
        value={fmt.number(stats.outOfStock)}
        active={stock === 'out'}
        onSelect={() => onSelect(stock === 'out' ? {} : { stock: 'out' })}
      />
      <StatTile
        label={tiles.draft}
        value={fmt.number(stats.draft)}
        active={status === 'draft'}
        onSelect={() => onSelect(status === 'draft' ? {} : { status: 'draft' })}
      />
    </>
  )
}
