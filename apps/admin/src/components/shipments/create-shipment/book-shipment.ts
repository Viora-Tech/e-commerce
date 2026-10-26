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
  /** The picked rate row's `optionKey`, or MANUAL for "ship it yourself". */
  pick: string
  /** The picked rate row: its courier and the service it books. */
  courier: {
    providerId: string
    serviceId: string | null
    /** The row's name ("Delhivery Surface"), kept on the shipment for its details. */
    providerLabel?: string | undefined
    needsTrackingNumber?: boolean | undefined
  } | null
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
    providerId: a.courier?.providerId,
    serviceId: a.courier?.serviceId ?? undefined,
    serviceLabel: a.courier?.providerLabel || undefined,
    // Booked at the courier's counter (India Post): the number from the receipt.
    trackingNumber: a.courier?.needsTrackingNumber ? a.typed.trackingNumber : undefined,
    fulfillmentOrderId: a.parcel.id ?? undefined,
    pickupLocationId: a.form.pickupLocationId,
    weightGrams: a.parsed.weightGrams,
    dimensionsCm: a.parsed.dimensionsCm,
    paymentMode: a.parsed.paymentMode,
    codAmountPaise: a.parsed.codAmountPaise,
  })
  /* Until the courier has a pickup request for this place and day, the waybill sits in its
     "Ready to Ship" list. The request goes out right after the booking; a refusal is recorded
     (not thrown), so its status is read here and the details view offers "Request pickup". */
  let pickupRequested = false
  if (a.pickup.ask && a.canPickup) {
    try {
      const pickups = await api.shipments.schedulePickup({
        shipmentIds: [s.id],
        date: a.pickup.date,
        timeFrom: a.pickup.timeFrom,
      })
      const refused = pickups.find((p) => p.status === 'failed')
      if (refused) toast.error(refused.error || a.pickupFailed)
      else pickupRequested = true
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
