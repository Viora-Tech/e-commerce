import { formatNumber } from '@commerce/money'
import StatStrip from '@/components/layout/stat-strip'
import { purchaseOrdersContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type PurchaseOrderCounts = Awaited<ReturnType<typeof api.purchaseOrders.counts>>

type PurchaseOrderTilesProps = { counts: PurchaseOrderCounts }

/** Drafts, open orders, units on the way and fully received orders. */
export default function PurchaseOrderTiles({ counts }: PurchaseOrderTilesProps) {
  // Hooks
  const { tiles: copy } = useCopy(purchaseOrdersContent)

  // Render logic
  return (
    <StatStrip
      tiles={[
        {
          id: 'draft',
          label: copy.draft,
          value: formatNumber(counts.draft),
          trendNote: copy.draftCaption,
        },
        {
          id: 'open',
          label: copy.open,
          value: formatNumber(counts.open),
          trendNote: copy.openCaption,
        },
        {
          id: 'incoming',
          label: copy.incoming,
          value: formatNumber(counts.incomingUnits),
          trendNote: copy.incomingCaption,
        },
        {
          id: 'received',
          label: copy.received,
          value: formatNumber(counts.received),
          trendNote: copy.receivedCaption,
        },
      ]}
    />
  )
}
