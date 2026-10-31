/** SOURCE OF TRUTH: "Send order link" — WHAT: staff send the shopper the signed link to their order page (`order_link`) by email and WhatsApp, and the timeline records it / WHY: Shopify's "Order link" message; customers ask "where is my order?" and the page answers it */
import { order, orderNote } from '@commerce/db'
import type { CustomMessage } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'

class OrderLinkNotSendable extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('ORDER_LINK_NOT_SENDABLE', message, { storeId })
  }
}

const ORDER_LINK_NOTE = 'Order link sent to the customer.'

/**
 * Queue `order_link` for a placed order (every channel the store has and the order can be
 * reached on). Each send goes out, so it can be sent again. A draft has no order page yet and
 * an imported order is a record only; an order without an email or phone has no one to send to.
 */
export async function sendOrderLink(
  ctx: StoreContext,
  orderId: string,
  opts: { author: string; custom?: CustomMessage | undefined },
): Promise<{ sent: true }> {
  const [o] = await ctx.tx
    .select({
      status: order.status,
      importedFrom: order.importedFrom,
      email: order.email,
      phone: order.phone,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o) throw new OrderLinkNotSendable('Order not found', ctx.storeId)
  if (o.status === 'draft') {
    throw new OrderLinkNotSendable('A draft has no order page yet: send its invoice', ctx.storeId)
  }
  if (o.importedFrom) {
    throw new OrderLinkNotSendable('Imported orders cannot send messages', ctx.storeId)
  }
  if (!o.email?.trim() && !o.phone?.trim()) {
    throw new OrderLinkNotSendable('This order has no email address or phone number', ctx.storeId)
  }
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.link_sent', { orderId, custom: opts.custom })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: ORDER_LINK_NOTE,
    author: opts.author,
  })
  return { sent: true }
}
