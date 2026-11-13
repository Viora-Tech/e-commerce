import type { AppBarContext, AppBarSummary } from '@commerce/plugins'

/**
 * The Delhivery app bar (Figma 928:11256): "Last tracking update 3 min ago" and the parcels in
 * transit on the Overview row. Only for members who can read orders (the Shipments workspace
 * needs the same); the platform's one-statement shipment read does the counting.
 */
export async function delhiveryAppBar({
  can,
  courierActivity,
}: AppBarContext): Promise<AppBarSummary | null> {
  if (!can('orders.read')) return null
  const { moving, lastUpdate } = await courierActivity('delhivery')
  if (!lastUpdate) return { statusPill: { label: 'No parcels booked yet', tone: 'neutral' } }
  return {
    statusPill: { label: 'Last tracking update', tone: 'success', at: lastUpdate },
    pageCounts: { '': moving },
  }
}
