import { formatNumber } from '@commerce/money'
import { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import StatTile from './stat-tile'

export type InventoryStats = Awaited<ReturnType<typeof api.inventory.stats>>

type InventoryTilesProps = { stats: InventoryStats }

const copy = inventoryContent.tiles

/** The four counts above the inventory table, for the selected location. */
export default function InventoryTiles({ stats }: InventoryTilesProps) {
  return (
    <>
      <StatTile title={copy.skus} value={formatNumber(stats.skus)} caption={copy.skusCaption} />
      <StatTile title={copy.out} value={formatNumber(stats.outOfStock)} caption={copy.outCaption} />
      <StatTile
        title={copy.low}
        value={formatNumber(stats.lowStock)}
        caption={copy.lowCaption(stats.lowThreshold)}
      />
      <StatTile
        title={copy.value}
        value={formatPaise(stats.valuePaise)}
        caption={copy.valueCaption}
      />
    </>
  )
}
