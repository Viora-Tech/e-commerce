import type { DashboardSummary } from '@commerce/api'
import { resolveDispatchLocation, resolveOrderLocation } from '@/data/geo'
import { homeContent } from '@/data/home'
import { formatPaise } from '@/lib/money'
import type { GlobeArc, GlobeMarker } from './types'

export type GlobeData = {
  markers: GlobeMarker[]
  arcs: GlobeArc[]
  newestOrderId: string | null
}

/**
 * Resolves each of the last 24h's orders (and the store's dispatch address) to lat/lng
 * client-side (see `data/geo.ts`), then shapes them into cobe markers/arcs. Orders whose
 * state code we do not recognise are skipped (no point to plot); everything else falls back
 * to its state's centroid when we do not have its city.
 */
export function buildGlobeData(summary: DashboardSummary): GlobeData {
  const c = homeContent.liveGlobe
  const newestOrderId = summary.mapOrders[0]?.id ?? null
  const dispatch = summary.dispatch
    ? resolveDispatchLocation(summary.dispatch.city, summary.dispatch.state)
    : null

  const markers: GlobeMarker[] = []
  const arcs: GlobeArc[] = []
  for (const order of summary.mapOrders) {
    const point = resolveOrderLocation(order.city, order.stateCode)
    if (!point) continue
    const isNewest = order.id === newestOrderId
    markers.push({
      id: order.id,
      lat: point.lat,
      lng: point.lng,
      isNewest,
      valuePaise: order.totalPaise,
      label: `${order.city}, ${c.tooltipOrder(order.number)}, ${formatPaise(order.totalPaise)}`,
      tooltip: (
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-popover-foreground">{order.city}</p>
          <p className="text-muted-foreground">{c.tooltipOrder(order.number)}</p>
          <p className="font-medium text-popover-foreground tabular-nums">
            {formatPaise(order.totalPaise)}
          </p>
        </div>
      ),
    })
    if (dispatch) {
      arcs.push({
        id: order.id,
        fromLat: dispatch.lat,
        fromLng: dispatch.lng,
        toLat: point.lat,
        toLng: point.lng,
        isNewest,
      })
    }
  }

  return { markers, arcs, newestOrderId }
}
