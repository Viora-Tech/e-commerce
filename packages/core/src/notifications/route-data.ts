/** SOURCE OF TRUTH: order email route ticket data — WHAT: the warehouse → shopper route, delivery address, money rows and payment state an order email shows / WHY: the Figma "Order placed" ticket; buildTemplateData spreads it in */
import { formatInZone } from '@commerce/dates'
import { address, type order } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData } from '@commerce/notifications'
import { formatDeliveryRange } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { ParcelView } from '../order/parcel-view'

type Order = typeof order.$inferSelect

/** Paid already, to pay on delivery, or a UPI / bank transfer still to come. */
function paymentStateOf(o: Order): TemplateData['paymentState'] {
  if (o.paymentMethod === 'cod' && !o.checkoutPaidAt) return 'cod'
  if (o.paymentMethod === 'manual' && !o.checkoutPaidAt) return 'unpaid'
  return 'paid'
}

/**
 * Everything the route ticket and the facts under the total need: where the one parcel leaves
 * from and where it goes, the courier service, the expected dates, the address, the subtotal
 * and discount, and how it is paid. An order in several parcels gets no route (the email lists
 * each parcel instead); one with no delivery address (a gift card) gets no route or address.
 */
export async function orderRouteData(
  ctx: StoreContext,
  o: Order,
  views: readonly ParcelView[],
): Promise<Partial<TemplateData>> {
  const [addr] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const live = views.filter((p) => p.status !== 'cancelled')
  const one = live.length === 1 ? live[0] : undefined
  const from = one ? one.city || one.locationName : null
  const discountName = o.discountCode || o.discountLabel
  return {
    paymentState: paymentStateOf(o),
    subtotalLabel: formatMoney(o.subtotalPaise),
    ...(o.discountPaise > 0
      ? {
          discount: {
            label: discountName ? `Discount (${discountName})` : 'Discount',
            amount: `− ${formatMoney(o.discountPaise)}`,
          },
        }
      : {}),
    placedLabel: formatInZone(o.placedAt, { day: 'numeric', month: 'long', year: 'numeric' }),
    ...(addr
      ? {
          shipTo: [
            addr.name,
            [addr.line1, addr.line2].filter(Boolean).join(', '),
            `${addr.city} ${addr.pincode}`,
          ],
        }
      : {}),
    ...(addr && one && from
      ? {
          route: {
            from,
            fromNote: one.locationName !== from ? one.locationName : undefined,
            to: addr.city,
            toNote: addr.name,
            via: o.shippingRateName || undefined,
            etaLabel: one.deliveryEstimate
              ? formatDeliveryRange(one.deliveryEstimate.earliest, one.deliveryEstimate.latest)
              : undefined,
          },
        }
      : {}),
  }
}
