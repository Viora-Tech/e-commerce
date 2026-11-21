import { payment } from '@commerce/db'
import { and, count, eq, gte } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

/*
 * Card testing guard (security audit 2026-11-20, finding CT-1). Someone holding a list of
 * stolen cards places one order and then taps "Retry payment" over and over, each tap a fresh
 * gateway order to try the next card on. A real shopper whose card is declined tries a few
 * times, or another card, or another way to pay; ten declines on one order inside an hour is
 * not a shopper. Past that, the order takes no new gateway attempt until the hour has passed.
 */

/** Failed gateway attempts one order may collect in `FAILED_TRIES_WINDOW_MS` before it rests. */
export const FAILED_TRIES_PER_HOUR = 10
export const FAILED_TRIES_WINDOW_MS = 60 * 60 * 1000

/** The checkout's refusal when the cart's order already used up its tries (see the file note). */
export class TooManyPaymentTries extends CommerceError {
  constructor(orderId: string, storeId?: string) {
    super('TOO_MANY_PAYMENT_TRIES', `Order ${orderId} had too many failed payments this hour`, {
      storeId,
    })
  }
}

/** Failed gateway attempts to pay this order (not a pre-order balance) inside the window. */
export async function recentFailedTries(
  ctx: StoreContext,
  orderId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - FAILED_TRIES_WINDOW_MS)
  const [row] = await ctx.tx
    .select({ n: count() })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.purpose, 'order'),
        eq(payment.status, 'failed'),
        gte(payment.createdAt, since),
      ),
    )
  return Number(row?.n ?? 0)
}

/** True while the order may still take a new gateway attempt. */
export async function hasPaymentTriesLeft(
  ctx: StoreContext,
  orderId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return (await recentFailedTries(ctx, orderId, now)) < FAILED_TRIES_PER_HOUR
}
