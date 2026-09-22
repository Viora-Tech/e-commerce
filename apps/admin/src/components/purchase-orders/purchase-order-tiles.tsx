import StatTile from '@/components/inventory/stat-tile'
import { purchaseOrdersContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'

export type PurchaseOrderCounts = Awaited<ReturnType<typeof api.purchaseOrders.counts>>

type PurchaseOrderTilesProps = { counts: PurchaseOrderCounts }

const number = new Intl.NumberFormat('en-IN')
const copy = purchaseOrdersContent.tiles

/** Drafts, open orders, units on the way and fully received orders. */
export default function PurchaseOrderTiles({ counts }: PurchaseOrderTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-[0.9375rem] xl:grid-cols-4">
      <StatTile
        title={copy.draft}
        value={number.format(counts.draft)}
        caption={copy.draftCaption}
      />
      <StatTile title={copy.open} value={number.format(counts.open)} caption={copy.openCaption} />
      <StatTile
        title={copy.incoming}
        value={number.format(counts.incomingUnits)}
        caption={copy.incomingCaption}
      />
      <StatTile
        title={copy.received}
        value={number.format(counts.received)}
        caption={copy.receivedCaption}
      />
    </div>
  )
}
