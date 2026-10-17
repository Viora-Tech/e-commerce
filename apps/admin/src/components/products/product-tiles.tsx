'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import StatStrip from '@/components/layout/stat-strip'
import type { StockFilter } from '@/data/products'
import { productsListContent } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'

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

  // Event handlers
  const handleChange = (filter: StockFilter | ProductStatus | null) => {
    if (filter === null) onSelect({})
    else if (filter === 'low' || filter === 'out' || filter === 'in') onSelect({ stock: filter })
    else onSelect({ status: filter })
  }

  return (
    <StatStrip
      active={stock ?? status}
      onChange={handleChange}
      tiles={[
        {
          id: 'total',
          label: tiles.total,
          value: fmt.number(stats.total),
          note: tiles.totalNote,
          filter: null,
        },
        {
          id: 'low',
          label: tiles.low,
          value: fmt.number(stats.lowStock),
          note: tiles.lowNote,
          filter: 'low',
        },
        {
          id: 'out',
          label: tiles.out,
          value: fmt.number(stats.outOfStock),
          note: tiles.outNote,
          filter: 'out',
        },
        {
          id: 'draft',
          label: tiles.draft,
          value: fmt.number(stats.draft),
          note: tiles.draftNote,
          filter: 'draft',
        },
      ]}
    />
  )
}
