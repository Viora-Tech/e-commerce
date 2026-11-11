/** SOURCE OF TRUTH: REFUND_ROUTES, refundOptions, refundOrderAmount — WHAT: how money goes back when staff cancel or edit an order (the original gateway, recorded by hand, or not at all) and spreading one amount over the order's payments / WHY: cancel and edit offer the same choice and must refund the same way */
import { payment } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { isSplitTender, STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { RefundNotAllowed, refundedPaise, refundPayment } from './refund'

/**
 * `original`: back through the gateway that took it (cash on delivery and manual payments are
 * recorded, gift cards go back onto the card). `manual`: the merchant sends it back themselves
 * and the refund is only recorded. `store_credit`: onto the store credit balance of the order's
 * customer (found or made from its email or phone), recorded as the refund of each payment it
 * covers; never a gift card code. `none`: nothing goes back.
 */
export const REFUND_ROUTES = ['original', 'manual', 'store_credit', 'none'] as const
export type RefundRoute = (typeof REFUND_ROUTES)[number]

/** Settled outside any gateway: "original" only records them. */
const OFFLINE = new Set(['cod', 'manual'])

type Held = {
  id: string
  provider: string
  providerPaymentId: string | null
  remainingPaise: number
}

/** Captured money on the order that has not gone back yet, gateway payments first, largest first. */
async function heldPayments(ctx: StoreContext, orderId: string): Promise<Held[]> {
  const rows = await ctx.tx
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), inArray(payment.status, ['captured', 'refunded'])))
  const held: Held[] = []
  for (const p of rows) {
    const remainingPaise = p.amountPaise - (await refundedPaise(ctx, p.id))
    if (remainingPaise <= 0) continue
    held.push({
      id: p.id,
      provider: p.provider,
      providerPaymentId: p.providerPaymentId,
      remainingPaise,
    })
  }
  // Gift cards and store credit last: the shopper would rather have money back than a balance.
  return held.sort(
    (a, b) =>
      Number(isSplitTender(a.provider)) - Number(isSplitTender(b.provider)) ||
      b.remainingPaise - a.remainingPaise,
  )
}

/**
 * How a store credit refund is given: the settings secret (a customer record made from the
 * order's email or phone stores the phone encrypted) and who gave it.
 */
export type StoreCreditIssue = {
  secret: string
  createdBy: string | null
  /** The last day money refunded to store credit can be spent (`YYYY-MM-DD`); null never. */
  expiresOn?: string | null | undefined
}

/** True when this payment's money can go back the way it came, with the store's gateways. */
const viaOriginal = (p: Held, providers: readonly PaymentProvider[]): boolean =>
  OFFLINE.has(p.provider) ||
  isSplitTender(p.provider) ||
  (!!p.providerPaymentId && providers.some((x) => x.id === p.provider))

export type RefundOptions = {
  /** Money taken on the order that has not gone back yet. */
  refundablePaise: number
  /**
   * "Refund to the original payment" is possible: every payment came through a gateway the store
   * still has connected (or cash, or a gift card). False for an imported order's payment, which
   * the source platform took: only a refund recorded by hand.
   */
  original: boolean
  /** The gateways the money would go back through, for the dialog's wording. */
  providers: string[]
}

export async function refundOptions(
  ctx: StoreContext,
  orderId: string,
  providers: readonly PaymentProvider[],
): Promise<RefundOptions> {
  const held = await heldPayments(ctx, orderId)
  return {
    refundablePaise: held.reduce((sum, p) => sum + p.remainingPaise, 0),
    original: held.length > 0 && held.every((p) => viaOriginal(p, providers)),
    providers: [...new Set(held.map((p) => p.provider))],
  }
}

/**
 * Send `amountPaise` back over the order's payments (gateway money first), the chosen way. The
 * route is checked before anything moves: `original` with a payment no connected gateway can
 * refund throws `RefundNotAllowed`. Each refund that did not fail writes `refund.created` (the
 * shopper's "refund issued" message, GST credit notes, affiliate commission). `none` and a zero
 * amount do nothing. Returns the refund ids.
 */
export async function refundOrderAmount(
  ctx: StoreContext,
  input: {
    orderId: string
    amountPaise: number
    route: RefundRoute
    reason: string
    providers: readonly PaymentProvider[]
    /** For `store_credit`: the settings secret and who gave it. */
    storeCredit?: StoreCreditIssue | undefined
    /**
     * Store credit the order spent, coming back: staff's expiry (a day, or null for never).
     * Left out, it keeps the expiry of the credit it was spent from.
     */
    returnedCreditExpiresOn?: string | null | undefined
  },
): Promise<string[]> {
  if (input.route === 'none' || input.amountPaise <= 0) return []
  const held = await heldPayments(ctx, input.orderId)
  const total = held.reduce((sum, p) => sum + p.remainingPaise, 0)
  if (input.amountPaise > total) {
    throw new RefundNotAllowed(`Only ${total} paise is left to refund on this order`, ctx.storeId)
  }
  const plan: { p: Held; amountPaise: number }[] = []
  let left = input.amountPaise
  for (const p of held) {
    if (left <= 0) break
    const take = Math.min(left, p.remainingPaise)
    plan.push({ p, amountPaise: take })
    left -= take
  }
  if (input.route === 'original') {
    const blocked = plan.find(({ p }) => !viaOriginal(p, input.providers))
    if (blocked) {
      throw new RefundNotAllowed(
        `The ${blocked.p.provider} payment cannot be refunded from here; record the refund by hand`,
        ctx.storeId,
      )
    }
  }
  if (input.route === 'store_credit' && !input.storeCredit) {
    throw new RefundNotAllowed('Store credit could not be given', ctx.storeId)
  }
  const ids: string[] = []
  for (const { p, amountPaise } of plan) {
    const provider = input.providers.find((x) => x.id === p.provider) ?? null
    const row = await refundPayment(ctx, input.route === 'original' ? provider : null, {
      paymentId: p.id,
      amountPaise,
      reason: input.reason,
      manual: input.route === 'manual',
      ...(input.route === 'store_credit'
        ? {
            method: 'store_credit' as const,
            secret: input.storeCredit?.secret,
            createdBy: input.storeCredit?.createdBy ?? null,
            storeCreditExpiresOn: input.storeCredit?.expiresOn ?? null,
          }
        : {}),
      // The order's own store credit always goes back onto the balance, whatever the route.
      ...(p.provider === STORE_CREDIT_PROVIDER
        ? { storeCreditExpiresOn: input.returnedCreditExpiresOn }
        : {}),
    })
    if (!row) continue
    ids.push(row.id)
    if (row.status !== 'failed') {
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'refund.created', {
        orderId: input.orderId,
        refundId: row.id,
      })
    }
  }
  return ids
}
