/** SOURCE OF TRUTH: return email data — WHAT: the template fields a return_* message needs (the items going back, the refund, the pickup) / WHY: `deliverNotification` builds order messages; a return message swaps in the return's own lines and details */
import { orderLine, returnRequest, returnRequestLine } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { RETURN_REASON_LABELS, type ReturnReason, returnLabel } from './policy'

export async function returnTemplateData(
  ctx: StoreContext,
  returnId: string,
): Promise<Partial<TemplateData> | null> {
  const [r] = await ctx.tx.select().from(returnRequest).where(eq(returnRequest.id, returnId))
  if (!r) return null
  const lines = await ctx.tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      unitPricePaise: orderLine.unitPricePaise,
      quantity: returnRequestLine.quantity,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  const value = lines.reduce((s, l) => s + l.quantity * l.unitPricePaise, 0)
  const reason = r.reason as ReturnReason | null
  return {
    lines: lines.map((l) => ({
      title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
        .filter(Boolean)
        .join(' / '),
      quantity: l.quantity,
      priceLabel: formatMoney(l.quantity * l.unitPricePaise, 'INR'),
    })),
    totalLabel: formatMoney(value, 'INR'),
    taxBreakdown: undefined,
    returnInfo: {
      label: returnLabel(r.number),
      reasonLabel: reason ? RETURN_REASON_LABELS[reason] : undefined,
      decisionNote: r.decisionNote ?? undefined,
      pickup: r.pickupMethod ?? undefined,
      pickupWaybill: r.pickupWaybill ?? undefined,
      refundLabel:
        r.refundAmountPaise !== null ? formatMoney(r.refundAmountPaise, 'INR') : undefined,
      refundMethod:
        r.resolution === 'store_credit'
          ? 'store_credit'
          : r.resolution === 'refund'
            ? 'original'
            : undefined,
    },
  }
}
