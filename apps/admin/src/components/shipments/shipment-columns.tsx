import StatusChip from '@/components/layout/status-chip'
import OrderChip from '@/components/orders/order-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { shipmentsContent } from '@/data/shipments'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

type Copy = typeof shipmentsContent
type ReadyRow = Awaited<ReturnType<typeof api.shipments.readyToShip>>['items'][number]
type ShipmentItem = Awaited<ReturnType<typeof api.shipments.list>>['items'][number]

/** One row of the Shipments table: an order still to book, or a booked shipment. */
export type ShipmentRow = {
  id: string
  orderId: string
  orderNumber: number
  placedAt: Date | string
  shipTo: string | null
  place: string
  /** Courier id, or null for an order still to book. */
  provider: string | null
  weightGrams: number | null
  /** Shipment status, or null for an order still to book. */
  status: string | null
  deliveryFailed: boolean
  labelUrl: string | null
  trackingUrl: string | null
}

const placeOf = (city: string | null, pincode: string | null) =>
  [city, pincode].filter(Boolean).join(' ')

export const rowFromOrder = (r: ReadyRow): ShipmentRow => ({
  id: r.orderId,
  orderId: r.orderId,
  orderNumber: r.orderNumber,
  placedAt: r.placedAt,
  shipTo: r.customerName ?? r.email,
  place: placeOf(r.city, r.pincode),
  provider: null,
  weightGrams: r.weightGrams,
  status: null,
  deliveryFailed: false,
  labelUrl: null,
  trackingUrl: null,
})

export const rowFromShipment = (s: ShipmentItem): ShipmentRow => ({
  id: s.id,
  orderId: s.orderId,
  orderNumber: s.orderNumber,
  placedAt: s.placedAt,
  shipTo: s.shipToName ?? s.email,
  place: placeOf(s.city, s.pincode),
  provider: s.provider,
  weightGrams: s.weightGrams,
  status: s.status,
  deliveryFailed: s.ndrStatus === 'pending',
  labelUrl: s.labelUrl,
  trackingUrl: s.trackingUrl,
})

/**
 * The Shipments table's columns (Figma "Orders / Shipments"): order and when, who it goes to
 * and where, courier, weight and status. `courierName` turns a courier id into its label; an
 * order still to book shows `toBookCourier` (the one courier, or "picked when booking").
 */
export function shipmentColumns(
  copy: Copy,
  fmt: Formatters,
  courierName: (id: string) => string,
  toBookCourier: string,
): ResourceColumnSpec<ShipmentRow>[] {
  return [
    {
      id: 'order',
      title: copy.columns.order,
      hideable: false,
      sortValue: (r) => r.orderNumber,
      className: 'w-40',
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="font-medium text-ink-strong tabular-nums">#{r.orderNumber}</span>
          <span className="text-caption text-muted-foreground">{fmt.when(r.placedAt)}</span>
        </span>
      ),
    },
    {
      id: 'shipTo',
      title: copy.columns.shipTo,
      align: 'start',
      className: 'whitespace-normal',
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="line-clamp-1 text-ink-strong">{r.shipTo ?? copy.guest}</span>
          <span className="text-caption text-muted-foreground tabular-nums">{r.place}</span>
        </span>
      ),
    },
    {
      id: 'courier',
      title: copy.columns.courier,
      align: 'start',
      render: (r) => (r.provider ? courierName(r.provider) : toBookCourier),
    },
    {
      id: 'weight',
      title: copy.columns.weight,
      align: 'start',
      sortValue: (r) => r.weightGrams ?? 0,
      render: (r) => (
        <span className="tabular-nums">
          {r.weightGrams ? copy.kg(r.weightGrams) : copy.noWeight}
        </span>
      ),
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'start',
      render: (r) =>
        r.status === null ? (
          <StatusChip tone="attention">{copy.toBookChip}</StatusChip>
        ) : r.deliveryFailed ? (
          <StatusChip tone="danger">{copy.deliveryFailed}</StatusChip>
        ) : (
          <OrderChip kind="shipment" value={r.status} />
        ),
    },
  ]
}
