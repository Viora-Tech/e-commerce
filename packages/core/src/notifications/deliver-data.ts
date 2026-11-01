/** SOURCE OF TRUTH: order email template data helpers — WHAT: GST lines, parcels, refund labels and the merchant notice a template shows / WHY: buildTemplateData reads them; split out of deliver.ts */
import { formatInZone } from '@commerce/dates'
import { order, payment, refund, store } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { EmailParcel, Recipient, TemplateData, TemplateId } from '@commerce/notifications'
import { formatDeliveryRange } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import type { ParcelView } from '../order/parcel-view'
import { manualCancelAt } from '../payments/manual-followup'
import { parsePaymentSettings } from '../payments/settings'
import { type GstBreakdown, gstRowsToShow } from '../tax/gst'

/** Human label for the order's payment_method id; adapters own the real label, this is the fallback. */
export const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on delivery',
  manual: 'UPI or bank transfer',
  razorpay: 'Razorpay',
  razorpay_upi: 'UPI',
}

const isGst = (v: unknown): v is GstBreakdown =>
  typeof v === 'object' && v !== null && typeof (v as GstBreakdown).taxPaise === 'number'

/**
 * The GST split for the totals block, straight from what the order already stored at checkout
 * (see `computeOrderGst` in `order/place-order.ts`) - never recomputed, so it always matches the
 * order's own invoice. Omitted when the order carries no tax.
 */
export function taxLines(o: typeof order.$inferSelect): TemplateData['taxBreakdown'] {
  const t = o.taxBreakdown
  if (!isGst(t) || t.taxPaise <= 0) return undefined
  const taxableLabel = formatMoney(o.totalPaise - t.taxPaise)
  // Parcels from different states put both CGST + SGST and IGST on one order.
  const show = gstRowsToShow(t)
  return [
    { label: 'Taxable value', amount: taxableLabel },
    ...(show.intraState
      ? [
          { label: `CGST (${t.ratePercent / 2}%)`, amount: formatMoney(t.cgstPaise) },
          { label: `SGST (${t.ratePercent / 2}%)`, amount: formatMoney(t.sgstPaise) },
        ]
      : []),
    ...(show.interState
      ? [{ label: `IGST (${t.ratePercent}%)`, amount: formatMoney(t.igstPaise) }]
      : []),
  ]
}

/** "Ships in 2 parcels" for an order leaving from several warehouses; undefined for one parcel. */
export function emailParcels(views: readonly ParcelView[]): EmailParcel[] | undefined {
  const live = views.filter((p) => p.status !== 'cancelled')
  if (live.length < 2) return undefined
  return live.map((p) => ({
    from: [p.city, p.stateName].filter(Boolean).join(', ') || p.locationName,
    items: p.lines.map((l) => {
      const variantTitle = l.variantTitle?.trim()
      const title = l.title?.trim() || 'Item'
      return {
        title:
          variantTitle && variantTitle !== 'Default' && variantTitle !== 'Default Title'
            ? `${title} / ${variantTitle}`
            : title,
        quantity: l.quantity,
      }
    }),
    dateRange: p.deliveryEstimate
      ? formatDeliveryRange(p.deliveryEstimate.earliest, p.deliveryEstimate.latest)
      : null,
    onHold: p.status === 'on_hold',
  }))
}

/** Human label for a refund's method, for the refund_issued message. */
function refundMethodLabel(provider: string): string {
  if (provider === GIFT_CARD_PROVIDER) return 'your gift card'
  return PAYMENT_LABELS[provider] ?? 'your original payment method'
}

/**
 * A gateway refund takes a few days to clear; a gift card or an offline method (COD, manual
 * transfer) the merchant settles directly does not have a bank-side wait to quote.
 */
function refundEtaLabel(provider: string): string | undefined {
  if (provider === GIFT_CARD_PROVIDER || provider === 'cod' || provider === 'manual') {
    return undefined
  }
  return '5 to 7 working days'
}

/** Everything the refund_issued message needs. Null when the refund row is gone. */
export async function refundTemplateData(
  ctx: StoreContext,
  refundId: string,
): Promise<Partial<TemplateData> | null> {
  const [r] = await ctx.tx.select().from(refund).where(eq(refund.id, refundId))
  if (!r) return null
  const [p] = await ctx.tx.select().from(payment).where(eq(payment.id, r.paymentId))
  const provider = p?.provider ?? ''
  return {
    refund: {
      amountLabel: formatMoney(r.amountPaise),
      methodLabel: refundMethodLabel(provider),
      etaLabel: refundEtaLabel(provider),
    },
  }
}

/** Messages asking for the balance: pointless (and confusing) once it is paid or the order is gone. */
export const BALANCE_ASKS: ReadonlySet<TemplateId> = new Set([
  'balance_request',
  'balance_reminder',
])

/** Messages for the merchant, not the shopper: sent by email to the store's contact address. */
export const MERCHANT_TEMPLATES: ReadonlySet<TemplateId> = new Set(['unpaid_cancel_notice'])

/**
 * Where a merchant message goes, and what it adds. Null when there is no
 * contact email, or the order no longer waits (paid or cancelled meanwhile).
 */
export async function merchantNotice(
  ctx: StoreContext,
  orderId: string,
): Promise<{ to: Recipient; data: Partial<TemplateData> } | null> {
  const [s] = await ctx.tx
    .select({ email: store.contactEmail, payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const [o] = await ctx.tx
    .select({
      status: order.status,
      checkoutPaidAt: order.checkoutPaidAt,
      placedAt: order.placedAt,
      noticeAt: order.unpaidCancelNoticeAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!s?.email || o?.status !== 'open' || o.checkoutPaidAt) return null
  const at = manualCancelAt(parsePaymentSettings(s.payments).manualCancelAfterHours, {
    placedAt: o.placedAt,
    cancelNoticeAt: o.noticeAt,
  })
  return {
    to: { email: s.email },
    data: {
      deadlineLabel: formatInZone(at, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  }
}
