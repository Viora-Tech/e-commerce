import type { AppBarContext, AppBarSummary } from '@commerce/plugins'

/** A tracking update or booking this recent went through the saved API key. */
const KEY_WORKED_MS = 2 * 24 * 60 * 60 * 1000

/**
 * The Delhivery app bar (Figma 928:11256): "API key working · last tracking update 3 min ago"
 * and the parcels in transit on the Shipments row. Only for members who can read orders (the
 * Shipments workspace needs the same); the platform's one-statement shipment read does the
 * counting. "API key working" only while a change landed in the last two days: an older one
 * says no more than when it was.
 */
export async function delhiveryAppBar(
  { can, courierActivity }: AppBarContext,
  now: Date = new Date(),
): Promise<AppBarSummary | null> {
  if (!can('orders.read')) return null
  const { moving, lastUpdate } = await courierActivity('delhivery')
  if (!lastUpdate) return { statusPill: { label: 'No parcels booked yet', tone: 'neutral' } }
  const recent = now.getTime() - lastUpdate.getTime() < KEY_WORKED_MS
  return {
    statusPill: {
      label: recent ? 'API key working · last tracking update' : 'Last tracking update',
      tone: 'success',
      at: lastUpdate,
    },
    pageCounts: { shipments: moving },
  }
}
