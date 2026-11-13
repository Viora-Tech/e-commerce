/** SOURCE OF TRUTH: "Ask to pay online" — WHAT: staff ask a cash on delivery shopper to pay through the store's gateway instead (`cod_pay_online` with their order page link), and the one automatic reminder two days later / WHY: when no courier takes COD to a PIN the order can still ship, prepaid; it stays a COD order, never cancelled for it, until the money arrives */
import { address, customer, type Db, order, orderNote, store, withStore } from '@commerce/db'
import type { CustomMessage } from '@commerce/notifications'
import { and, asc, eq, isNotNull, isNull, lte } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import { parsePaymentSettings } from './settings'
import { isSplitTender } from './split-tender'

/*
 * Owner, 13 Nov 2026. The bulk ship drawer's "Ask to pay online" (no courier takes cash on
 * delivery to this PIN) and the order page's More actions send the shopper `cod_pay_online`:
 * email, and WhatsApp once Meta approves a template of that name. The link opens their order
 * page, which offers "Pay online now" (`payOnlineInstead`). Until a gateway capture covers the
 * order it stays cash on delivery: the unpaid expiry never touches it, and the COD confirmation
 * sweep does not auto-cancel it. One reminder goes two days after the request if still unpaid.
 */

const DAY_MS = 86_400_000
/** How long after the request the one reminder goes, if the order is still unpaid. */
const PAY_ONLINE_REMIND_AFTER_DAYS = 2
/** Orders reminded per store per run; the next run takes the rest. */
const BATCH = 50

/** Paid outside a gateway: a store with only these has nothing to pay online with. */
const OFFLINE_PROVIDERS: ReadonlySet<string> = new Set(['cod', 'manual'])

const PAY_ONLINE_REQUESTED_NOTE =
  'Asked the customer to pay online instead of cash on delivery. Payment link sent.'
const PAY_ONLINE_REMINDED_NOTE =
  'Automatic reminder sent to the customer to pay online instead of cash on delivery.'

class PayOnlineNotRequestable extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('PAY_ONLINE_NOT_REQUESTABLE', message, { storeId })
  }
}

/** Still a cash on delivery order waiting for its money: what the request and reminder need. */
const stillCodUnpaid = (orderId: string) =>
  and(
    eq(order.id, orderId),
    eq(order.status, 'open'),
    isNull(order.checkoutPaidAt),
    eq(order.paymentMethod, 'cod'),
    isNull(order.importedFrom),
  )

/** Why this order cannot be asked to pay online, in the merchant's words; null when it can. */
function refusal(o: typeof order.$inferSelect): string | null {
  if (o.status === 'draft') return 'A draft has no order page yet: send its invoice'
  if (o.importedFrom) return 'Imported orders cannot send messages'
  if (o.status === 'cancelled') return 'This order is cancelled'
  if (o.status !== 'open') return 'This order is closed'
  if (o.checkoutPaidAt || o.paymentStatus === 'paid') return 'This order is already paid'
  if (o.paymentMethod !== 'cod') return 'Only cash on delivery orders can be asked to pay online'
  if (o.fulfillmentStatus !== 'unfulfilled') {
    return 'This order is already packed as cash on delivery'
  }
  if (!o.email?.trim() && !o.phone?.trim()) {
    return 'This order has no email address or phone number'
  }
  return null
}

/** The name staff know the shopper by: the delivery address's, else the customer record's. */
async function customerNameOf(
  ctx: StoreContext,
  o: { shippingAddressId: string | null; customerId: string | null },
): Promise<string | null> {
  if (o.shippingAddressId) {
    const [a] = await ctx.tx
      .select({ name: address.name })
      .from(address)
      .where(eq(address.id, o.shippingAddressId))
    if (a?.name?.trim()) return a.name.trim()
  }
  if (!o.customerId) return null
  const [c] = await ctx.tx
    .select({ name: customer.name })
    .from(customer)
    .where(eq(customer.id, o.customerId))
  return c?.name?.trim() || null
}

/**
 * Ask the shopper of an unpaid cash on delivery order to pay online: records when (`order.
 * pay_online_requested_at`; asking again restarts the reminder's two days), notes it on the
 * timeline and queues `cod_pay_online` with the signed order page link. Under the order's row
 * lock, so two quick clicks record one state.
 */
export async function requestOnlinePayment(
  ctx: StoreContext,
  orderId: string,
  opts: { author: string; custom?: CustomMessage | undefined; now?: Date | undefined },
): Promise<{ requestedAt: Date; customerName: string | null }> {
  const now = opts.now ?? new Date()
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) throw new PayOnlineNotRequestable('Order not found', ctx.storeId)
  const why = refusal(o)
  if (why) throw new PayOnlineNotRequestable(why, ctx.storeId)
  const [s] = await ctx.tx
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const online = parsePaymentSettings(s?.payments).enabled.some(
    (id) => !OFFLINE_PROVIDERS.has(id) && !isSplitTender(id),
  )
  if (!online) {
    throw new PayOnlineNotRequestable(
      'Turn on an online payment method in Settings › Payments first',
      ctx.storeId,
    )
  }
  await ctx.tx
    .update(order)
    .set({ payOnlineRequestedAt: now, payOnlineRemindedAt: null })
    .where(eq(order.id, orderId))
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.pay_online_requested', {
    orderId,
    custom: opts.custom,
  })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: PAY_ONLINE_REQUESTED_NOTE,
    author: opts.author,
  })
  return { requestedAt: now, customerName: await customerNameOf(ctx, o) }
}

/** Requests two days old, still unpaid and not reminded yet, oldest first. */
async function payOnlineReminderCandidates(ctx: StoreContext, now: Date) {
  const due = new Date(now.getTime() - PAY_ONLINE_REMIND_AFTER_DAYS * DAY_MS)
  return ctx.tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        eq(order.paymentMethod, 'cod'),
        isNull(order.importedFrom),
        isNotNull(order.payOnlineRequestedAt),
        lte(order.payOnlineRequestedAt, due),
        isNull(order.payOnlineRemindedAt),
      ),
    )
    .orderBy(asc(order.payOnlineRequestedAt))
    .limit(BATCH)
}

/**
 * Remind one shopper, once: a conditional update stamps `pay_online_reminded_at` only while the
 * order still waits, so overlapping runs send one. Nothing is cancelled. False when it no longer
 * needs a reminder.
 */
async function remindOnlinePayment(
  ctx: StoreContext,
  orderId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const due = new Date(now.getTime() - PAY_ONLINE_REMIND_AFTER_DAYS * DAY_MS)
  const [moved] = await ctx.tx
    .update(order)
    .set({ payOnlineRemindedAt: now })
    .where(
      and(
        stillCodUnpaid(orderId),
        lte(order.payOnlineRequestedAt, due),
        isNull(order.payOnlineRemindedAt),
      ),
    )
    .returning({ id: order.id })
  if (!moved) return false
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.pay_online_requested', { orderId })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: PAY_ONLINE_REMINDED_NOTE,
    author: 'system',
  })
  return true
}

/** One store's reminder run; returns how many shoppers were reminded. */
export async function runPayOnlineReminders(
  db: Db,
  storeId: string,
  now: Date = new Date(),
): Promise<number> {
  const due = await withStore(db, storeId, (tx) =>
    payOnlineReminderCandidates({ storeId, tx }, now),
  )
  let reminded = 0
  for (const o of due) {
    if (await withStore(db, storeId, (tx) => remindOnlinePayment({ storeId, tx }, o.id, now))) {
      reminded += 1
    }
  }
  return reminded
}
