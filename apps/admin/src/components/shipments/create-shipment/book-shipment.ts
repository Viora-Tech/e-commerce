import { toast } from 'sonner'
import type { trackingPayload } from '@/components/orders/tracking-fields'
import { api } from '@/lib/api-client'
import type { BookedShipment } from './done-step'
import {
  type DraftOrder,
  type DraftParcel,
  MANUAL,
  type PackageForm,
  type ParsedPackage,
} from './flow-state'
import type { PickupPlan } from './pickup-plan'

type BookShipmentArgs = {
  order: DraftOrder
  parcel: DraftParcel
  form: PackageForm
  parsed: ParsedPackage
  /** A courier's provider id, or MANUAL for "ship it yourself". */
  pick: string
  /** The AWB and courier name typed for MANUAL, already trimmed. */
  typed: ReturnType<typeof trackingPayload>
  courierLabel: string | undefined
  canPickup: boolean
  pickup: PickupPlan
  /** Toast text when the courier turns the pickup request down. */
  pickupFailed: string
}

/** Book the parcel with the picked courier (or record the merchant's own AWB), then ask for the
 *  pickup when the plan says so. The booking stands even if the courier refuses the pickup: the
 *  done step offers it again. */
export async function bookShipment(a: BookShipmentArgs): Promise<BookedShipment> {
  if (a.pick === MANUAL) {
    const r = await api.orders.fulfil({
      orderId: a.order.orderId,
      lines: a.parcel.lines.map((l) => ({ lineId: l.id, quantity: l.quantity })),
      ...a.typed,
    })
    return {
      shipmentId: r.shipmentId,
      courier: a.typed.courier ?? '',
      waybill: a.typed.trackingNumber ?? '',
      labelUrl: null,
      trackingUrl: a.typed.trackingUrl ?? null,
      manual: true,
      canPickup: false,
    }
  }
  const s = await api.orders.createShipment({
    orderId: a.order.orderId,
    providerId: a.pick,
    fulfillmentOrderId: a.parcel.id ?? undefined,
    pickupLocationId: a.form.pickupLocationId,
    weightGrams: a.parsed.weightGrams,
    dimensionsCm: a.parsed.dimensionsCm,
    paymentMode: a.parsed.paymentMode,
    codAmountPaise: a.parsed.codAmountPaise,
  })
  let pickupRequested = false
  if (a.pickup.ask && a.canPickup) {
    try {
      await api.shipments.schedulePickup({
        shipmentIds: [s.id],
        date: a.pickup.date,
        timeFrom: a.pickup.timeFrom,
      })
      pickupRequested = true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : a.pickupFailed)
    }
  }
  return {
    shipmentId: s.id,
    courier: a.courierLabel ?? s.provider,
    waybill: s.waybill,
    labelUrl: s.labelUrl,
    trackingUrl: s.trackingUrl,
    manual: false,
    canPickup: a.canPickup,
    pickupRequested,
  }
}
