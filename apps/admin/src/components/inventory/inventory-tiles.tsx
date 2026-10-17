import { formatNumber } from '@commerce/money'
import StatStrip from '@/components/layout/stat-strip'
import { inventoryContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

export type InventoryStats = Awaited<ReturnType<typeof api.inventory.stats>>

type InventoryTilesProps = { stats: InventoryStats }

/** The four counts above the inventory table, for the selected location. */
export default function InventoryTiles({ stats }: InventoryTilesProps) {
  // Hooks
  const { tiles: copy } = useCopy(inventoryContent)

  // Render logic
  return (
    <StatStrip
      tiles={[
        {
          id: 'skus',
          label: copy.skus,
          value: formatNumber(stats.skus),
          trendNote: copy.skusCaption,
        },
        {
          id: 'out',
          label: copy.out,
          value: formatNumber(stats.outOfStock),
          trendNote: copy.outCaption,
        },
        {
          id: 'low',
          label: copy.low,
          value: formatNumber(stats.lowStock),
          trendNote: copy.lowCaption(stats.lowThreshold),
        },
        {
          id: 'value',
          label: copy.value,
          value: formatPaise(stats.valuePaise),
          trendNote: copy.valueCaption,
        },
      ]}
    />
  )
}
