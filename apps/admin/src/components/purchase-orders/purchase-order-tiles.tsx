import { formatNumber } from '@commerce/money'
import StatTile from '@/components/inventory/stat-tile'
import { purchaseOrdersContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'

export type PurchaseOrderCounts = Awaited<ReturnType<typeof api.purchaseOrders.counts>>

type PurchaseOrderTilesProps = { counts: PurchaseOrderCounts }

const copy = purchaseOrdersContent.tiles

/** Drafts, open orders, units on the way and fully received orders. */
export default function PurchaseOrderTiles({ counts }: PurchaseOrderTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-[0.9375rem] xl:grid-cols-4">
      <StatTile title={copy.draft} value={formatNumber(counts.draft)} caption={copy.draftCaption} />
      <StatTile title={copy.open} value={formatNumber(counts.open)} caption={copy.openCaption} />
      <StatTile
        title={copy.incoming}
        value={formatNumber(counts.incomingUnits)}
        caption={copy.incomingCaption}
      />
      <StatTile
        title={copy.received}
        value={formatNumber(counts.received)}
        caption={copy.receivedCaption}
      />
    </div>
  )
}
