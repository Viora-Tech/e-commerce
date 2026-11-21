/** SOURCE OF TRUTH: order email event facts — WHAT: when the parcel was delivered, the payment's reference and the tracking number a changed shipment replaced / WHY: the Figma "Delivered", "Payment received" and "Shipping update" emails show them; buildTemplateData and the shipping_update path spread them in */
import { formatInZone } from '@commerce/dates'
import { payment, shipment } from '@commerce/db'
import type { TemplateData } from '@commerce/notifications'
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { carriesOrder } from '../shipping/carries-order'

/** "Fri 21 Nov, 2:14 pm", in the store's time zone (India). */
const deliveredFormat: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
}

/**
 * When the order's parcel was delivered (the courier's delivered scan) and the reference of the
 * payment that paid it (the gateway's payment id, or the transfer's own reference). Each is left
 * out when not known yet.
 */
export async function orderEventData(
  ctx: StoreContext,
  orderId: string,
): Promise<Partial<TemplateData>> {
  const [delivered] = await ctx.tx
    .select({ at: shipment.deliveredAt })
    .from(shipment)
    .where(and(carriesOrder(orderId), isNotNull(shipment.deliveredAt)))
    .orderBy(desc(shipment.deliveredAt))
    .limit(1)
  const [paid] = await ctx.tx
    .select({ ref: payment.providerRef, paymentId: payment.providerPaymentId })
    .from(payment)
    .where(and(eq(payment.orderId, orderId), eq(payment.status, 'captured')))
    .orderBy(desc(payment.createdAt))
    .limit(1)
  return {
    ...(delivered?.at
      ? { deliveredLabel: formatInZone(delivered.at, deliveredFormat, { locale: 'en-GB' }) }
      : {}),
    ...(paid ? { paymentRef: paid.paymentId || paid.ref } : {}),
  }
}

/**
 * The tracking number the shopper had before this shipment replaced it: the order's newest
 * other booking (a label cancelled and booked again). Undefined when there was none, or when the
 * courier changed the number on the same booking (the old one is not kept).
 */
export async function previousWaybill(
  ctx: StoreContext,
  orderId: string,
  shipmentId: string,
): Promise<string | undefined> {
  const [prev] = await ctx.tx
    .select({ waybill: shipment.waybill })
    .from(shipment)
    .where(and(eq(shipment.orderId, orderId), ne(shipment.id, shipmentId)))
    .orderBy(desc(shipment.createdAt))
    .limit(1)
  return prev?.waybill || undefined
}
