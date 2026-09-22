import { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import StatTile from './stat-tile'

export type InventoryStats = Awaited<ReturnType<typeof api.inventory.stats>>

type InventoryTilesProps = { stats: InventoryStats }

const number = new Intl.NumberFormat('en-IN')
const copy = inventoryContent.tiles

/** The four counts above the inventory table, for the selected location. */
export default function InventoryTiles({ stats }: InventoryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-[0.9375rem] xl:grid-cols-4">
      <StatTile title={copy.skus} value={number.format(stats.skus)} caption={copy.skusCaption} />
      <StatTile
        title={copy.out}
        value={number.format(stats.outOfStock)}
        caption={copy.outCaption}
        tone={stats.outOfStock > 0 ? 'error' : 'default'}
      />
      <StatTile
        title={copy.low}
        value={number.format(stats.lowStock)}
        caption={copy.lowCaption(stats.lowThreshold)}
        tone={stats.lowStock > 0 ? 'warning' : 'default'}
      />
      <StatTile
        title={copy.value}
        value={formatPaise(stats.valuePaise)}
        caption={copy.valueCaption}
      />
    </div>
  )
}
