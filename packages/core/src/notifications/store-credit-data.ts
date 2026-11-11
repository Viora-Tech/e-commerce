/** SOURCE OF TRUTH: store credit in order emails — WHAT: the store credit fields an order message shows: a draft invoice's "Store credit −₹X / To pay ₹Y", and the one balance line when the balance moved (used on the order, or added by a refund or a return) / WHY: the shopper sees what their credit paid and what is left only in the messages where it changed (owner, 12 Nov 2026), never in the others */
import { order, payment, refund, returnRequest, storeCreditEntry } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData, TemplateId } from '@commerce/notifications'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { spendableStoreCredit } from '../customers/store-credit-expiry'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'

/** "−₹500.00": store credit taken off a total. */
const minus = (paise: number) => `−${formatMoney(paise)}`

/** The customer whose balance a refund to store credit on this order went to (the newest). */
async function refundHolder(ctx: StoreContext, orderId: string): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ customerId: storeCreditEntry.customerId })
    .from(storeCreditEntry)
    .where(and(eq(storeCreditEntry.orderId, orderId), eq(storeCreditEntry.kind, 'refund')))
    .orderBy(desc(storeCreditEntry.id))
    .limit(1)
  return row?.customerId ?? null
}

/** "₹X added to your store credit · balance ₹Y" data, or null when nobody's balance got it. */
async function added(
  ctx: StoreContext,
  orderId: string,
  amountPaise: number,
): Promise<Partial<TemplateData> | null> {
  if (amountPaise <= 0) return null
  const customerId = await refundHolder(ctx, orderId)
  if (!customerId) return null
  const balance = await spendableStoreCredit(ctx, customerId)
  return {
    storeCredit: {
      change: {
        kind: 'added',
        amountLabel: formatMoney(amountPaise),
        balanceLabel: formatMoney(balance),
      },
    },
  }
}

/**
 * The store credit fields for one order message, or null when store credit had no part in it:
 * - `draft_invoice`: the credit applied to the draft, and what is left to pay;
 * - `order_placed`: what the order took from the balance, and the balance now;
 * - `refund_issued` (a refund onto the balance) and `return_refunded` (a return settled as store
 *   credit): what was added, and the balance now.
 * Every other message gets nothing.
 */
export async function storeCreditTemplateData(
  ctx: StoreContext,
  input: {
    template: TemplateId
    orderId: string
    refundId?: string | undefined
    returnId?: string | undefined
  },
): Promise<Partial<TemplateData> | null> {
  switch (input.template) {
    case 'draft_invoice': {
      const rows = await ctx.tx
        .select({ amountPaise: payment.amountPaise })
        .from(payment)
        .where(
          and(
            eq(payment.orderId, input.orderId),
            eq(payment.provider, STORE_CREDIT_PROVIDER),
            inArray(payment.status, ['created', 'pending', 'captured']),
          ),
        )
      const applied = rows.reduce((sum, r) => sum + r.amountPaise, 0)
      if (applied <= 0) return null
      const [o] = await ctx.tx
        .select({ totalPaise: order.totalPaise })
        .from(order)
        .where(eq(order.id, input.orderId))
      if (!o) return null
      return {
        storeCredit: {
          appliedLabel: minus(applied),
          toPayLabel: formatMoney(Math.max(0, o.totalPaise - applied)),
        },
      }
    }
    case 'order_placed': {
      const rows = await ctx.tx
        .select({
          customerId: storeCreditEntry.customerId,
          amountPaise: storeCreditEntry.amountPaise,
        })
        .from(storeCreditEntry)
        .where(
          and(eq(storeCreditEntry.orderId, input.orderId), eq(storeCreditEntry.kind, 'payment')),
        )
      const used = -rows.reduce((sum, r) => sum + r.amountPaise, 0)
      const customerId = rows[0]?.customerId
      if (used <= 0 || !customerId) return null
      const balance = await spendableStoreCredit(ctx, customerId)
      return {
        storeCredit: {
          change: {
            kind: 'used',
            amountLabel: formatMoney(used),
            balanceLabel: formatMoney(balance),
          },
        },
      }
    }
    case 'refund_issued': {
      if (!input.refundId) return null
      const [r] = await ctx.tx
        .select({
          method: refund.method,
          giftCardId: refund.giftCardId,
          amountPaise: refund.amountPaise,
        })
        .from(refund)
        .where(eq(refund.id, input.refundId))
      if (r?.method !== 'store_credit' || r.giftCardId) return null
      return added(ctx, input.orderId, r.amountPaise)
    }
    case 'return_refunded': {
      if (!input.returnId) return null
      const [r] = await ctx.tx
        .select({
          resolution: returnRequest.resolution,
          refundAmountPaise: returnRequest.refundAmountPaise,
        })
        .from(returnRequest)
        .where(eq(returnRequest.id, input.returnId))
      if (r?.resolution !== 'store_credit' || r.refundAmountPaise === null) return null
      return added(ctx, input.orderId, r.refundAmountPaise)
    }
    default:
      return null
  }
}
