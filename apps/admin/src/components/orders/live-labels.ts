import type { OrderDetail } from './order-detail-types'
import type { ShipmentChoice } from './shipment-choice'

/** Labels that can still be cancelled, newest first: Cancel shipment asks which (two or more). */
export function liveLabels(parts: OrderDetail['partShipping']): ShipmentChoice[] {
  return (parts?.parcels ?? [])
    .flatMap((p) => (p.shipment && p.shipment.status === 'created' ? [p.shipment] : []))
    .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())
    .map((sh) => ({
      id: sh.id,
      label: `${sh.serviceLabel ?? sh.providerLabel} · AWB ${sh.waybill}`,
    }))
}
