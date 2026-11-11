/** SOURCE OF TRUTH: draftInvoiceLink — WHAT: where a `draft_invoice` message's pay button points: a staff draft's signed invoice page, or a shopper's checkout draft's own order page (where it pays or retries), and whether that checkout draft still waits for payment / WHY: delivery and the "Review email" preview must fill the same link, and the invoice page refuses checkout drafts */
import { order } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { isOpenCheckoutDraft } from '../order/checkout-draft'
import { invoiceUrl, thankYouUrl } from '../preorder/balance-link'

export type DraftInvoiceLink = {
  /** The pay link; undefined without a storefront origin. */
  actionUrl: string | undefined
  /** A shopper's checkout draft (the "Send payment link" button), not a staff draft. */
  fromCheckout: boolean
  /** A checkout draft paid, converted or expired since: nothing is left to ask for. */
  stale: boolean
}

export async function draftInvoiceLink(
  ctx: StoreContext,
  orderId: string,
  secret: string,
  origin: string | undefined,
): Promise<DraftInvoiceLink> {
  const [o] = await ctx.tx
    .select({
      number: order.number,
      status: order.status,
      draftSource: order.draftSource,
      draftExpiredAt: order.draftExpiredAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
  const fromCheckout = o?.draftSource === 'checkout'
  if (o && fromCheckout) {
    return {
      // The same link as the draft page's "Copy payment link".
      actionUrl: origin ? thankYouUrl(orderId, o.number, secret, origin) : undefined,
      fromCheckout,
      stale: !isOpenCheckoutDraft(o),
    }
  }
  return {
    actionUrl: origin ? invoiceUrl(orderId, secret, origin) : undefined,
    fromCheckout: false,
    stale: false,
  }
}
