/** SOURCE OF TRUTH: "Edit" on a shopper's unpaid checkout draft — WHAT: staff take the checkout over as an ordinary staff draft: every gateway try is checked first (money in or on its way refuses), the open tries are cancelled so the old payment link stops, the discount uses are given back for the convert to count again, and a timeline line says who did it / WHY: an unpaid checkout was read-only, so staff could not fix a quantity or an address for the shopper (owner, 18 Nov 2026) */
import { order, orderNote, payment } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { paymentAttempts } from '../payments/attempts'
import { TAKEN_OVER_ATTEMPT_ERROR } from '../payments/confirm'
import { readShopperPaid } from '../payments/shopper-paid'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import { isCheckoutDraft, releaseOrderDiscountUses } from './checkout-draft'

/** Why a checkout draft cannot be taken over to edit. The admin shows its own words for each. */
export const TAKE_OVER_REFUSALS = [
  /** No such draft in this store. */
  'not_found',
  /** Not a shopper's unpaid checkout any more: converted, paid, or already taken over. */
  'not_checkout',
  /** Money was captured on it (it may need refunding first). */
  'paid',
  /** A payment is authorised, or the gateway says one has gone through and its webhook is on the way. */
  'in_progress',
  /** The shopper said "I've paid" on a UPI / bank transfer: check the bank first. */
  'shopper_paid',
  /** Gift card or store credit is held on it: those are not moved onto a staff draft. */
  'split_tender',
  /** The gateway could not be asked (switched off, keys gone, or down): try again later. */
  'unchecked',
] as const
export type TakeOverRefusal = (typeof TAKE_OVER_REFUSALS)[number]

const REFUSAL_TEXT: Record<TakeOverRefusal, string> = {
  not_found: 'Draft not found',
  not_checkout:
    'This is no longer an unpaid checkout: it was paid, converted or already taken over',
  paid:
    'A payment was captured on this checkout, so it cannot be edited. Convert it or refund the payment first.',
  in_progress:
    'A payment on this checkout is going through right now. Wait a few minutes and refresh the page.',
  shopper_paid:
    'The shopper says they have paid by UPI or bank transfer. Check your bank and mark it paid instead.',
  split_tender:
    'A gift card or store credit is held on this checkout, so it cannot be edited. Convert it to an order instead.',
  unchecked:
    'Could not check this checkout’s payment with the gateway, so it was not changed. Try again in a few minutes.',
}

export class CheckoutDraftNotTakeable extends CommerceError {
  readonly reason: TakeOverRefusal

  constructor(reason: TakeOverRefusal, storeId?: string) {
    super('CHECKOUT_DRAFT_NOT_TAKEABLE', REFUSAL_TEXT[reason], { storeId })
    this.reason = reason
  }
}

/** The draft's timeline line: "priya@shop.in took over unpaid checkout to edit; old payment link stopped". */
export const TAKE_OVER_NOTE = (author: string): string =>
  `${author} took over unpaid checkout to edit; old payment link stopped`

/** Timeline line when the shopper's payment-method fee or discount could not stay on the draft. */
export const ADJUSTMENT_DROPPED_NOTE = (label: string | null): string =>
  `The payment method's ${label ? `"${label}" ` : ''}fee or discount was taken off: staff drafts price without one.`

/** Gift card and store credit rows that still hold or took money. */
const LIVE_SPLIT_TENDER = ['created', 'pending', 'authorized', 'captured'] as const

/** Tries that never kept money: the take-over stops and marks each one. */
const STOPPABLE: ReadonlySet<string> = new Set(['created', 'pending', 'failed', 'cancelled'])

type Truth = Awaited<ReturnType<PaymentProvider['fetchStatus']>>

/**
 * Ask the gateway about every try it answered, as the unpaid expiry does (`expireUnpaidOrder`):
 * a cancelled or failed Razorpay try can still be paid inside its gateway order, so none is
 * skipped. Null when nothing has moved; otherwise why the take-over must stop.
 */
async function gatewayRefusal(
  attempts: Awaited<ReturnType<typeof paymentAttempts>>,
  providers: readonly PaymentProvider[],
): Promise<TakeOverRefusal | null> {
  const asked = attempts.filter(
    (a) => a.checkoutSession !== null && a.status !== 'refunded' && a.status !== 'captured',
  )
  for (const a of asked) {
    const provider = providers.find((p) => p.id === a.provider)
    if (!provider) return 'unchecked'
    let truth: Truth
    try {
      truth = await provider.fetchStatus(a.providerRef)
    } catch {
      return 'unchecked'
    }
    // Recorded by its webhook (or the reconcile) as usual; the merchant refreshes to see it.
    if (truth.status === 'captured' || truth.status === 'authorized') return 'in_progress'
  }
  return null
}

/**
 * "Edit" on a shopper's unpaid checkout: it becomes a staff draft (`draft_source = 'staff'`) the
 * normal draft form edits, sends an invoice for and converts. Same row, id, #D number, contact,
 * addresses, lines, discount, shipping, hold and sale source (attribution).
 *
 * Refused (CheckoutDraftNotTakeable, nothing changed) when money is in or on its way: a captured
 * or authorised try, a gateway that now reports one, an "I've paid" on a transfer, held gift card
 * or store credit, or a gateway that cannot be asked.
 *
 * Otherwise every try that never kept money is cancelled and marked, so the old link's page offers
 * no payment and its retry is refused (`retryPayment` wants an open order or checkout draft). A
 * gateway order the shopper still has open cannot be cancelled at the gateway (Razorpay has no
 * such call): a capture on a marked try later is flagged refund needed by `applyPaymentStatus`,
 * before or after the draft converts, never kept as its money.
 */
export async function takeOverCheckoutDraft(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** The staff member, for the timeline (their email). */
    author: string
    /** The store's connected gateways, to ask about each try. */
    providers: readonly PaymentProvider[]
    now?: Date | undefined
  },
): Promise<{ id: string; cancelledAttempts: number }> {
  const now = opts.now ?? new Date()
  // Locked: a webhook for this draft waits, and sees a staff draft once this commits.
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) throw new CheckoutDraftNotTakeable('not_found', ctx.storeId)
  if (!isCheckoutDraft(o)) throw new CheckoutDraftNotTakeable('not_checkout', ctx.storeId)

  const attempts = (await paymentAttempts(ctx, orderId)).filter((a) => a.purpose === 'order')
  if (attempts.some((a) => a.status === 'captured' || a.status === 'refunded')) {
    throw new CheckoutDraftNotTakeable('paid', ctx.storeId)
  }
  if (attempts.some((a) => a.status === 'authorized')) {
    throw new CheckoutDraftNotTakeable('in_progress', ctx.storeId)
  }
  const open = attempts.filter((a) => a.status === 'created' || a.status === 'pending')
  if (open.some((a) => readShopperPaid(a.checkoutSession) !== null)) {
    throw new CheckoutDraftNotTakeable('shopper_paid', ctx.storeId)
  }
  const [split] = await ctx.tx
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        inArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
        inArray(payment.status, [...LIVE_SPLIT_TENDER]),
      ),
    )
    .limit(1)
  if (split) throw new CheckoutDraftNotTakeable('split_tender', ctx.storeId)
  const refusal = await gatewayRefusal(attempts, opts.providers)
  if (refusal) throw new CheckoutDraftNotTakeable(refusal, ctx.storeId)

  // Every try that never kept money is stopped and marked, failed ones too: a Razorpay order
  // stays payable after a failed try, and a capture on a marked try is refunded, never kept.
  const stoppable = attempts.filter((a) => STOPPABLE.has(a.status)).map((a) => a.id)
  if (stoppable.length > 0) {
    await ctx.tx
      .update(payment)
      .set({
        status: 'cancelled',
        error: sql`case when ${payment.error} is null then ${TAKEN_OVER_ATTEMPT_ERROR}::text
          else ${TAKEN_OVER_ATTEMPT_ERROR}::text || ' (was: ' || ${payment.error} || ')' end`,
      })
      .where(inArray(payment.id, stoppable))
  }
  // Its code or automatic discount counted a use at checkout; converting counts it again.
  await releaseOrderDiscountUses(ctx, orderId)
  await ctx.tx
    .update(order)
    .set({
      draftSource: 'staff',
      draftExpiredAt: null,
      lastActivityAt: now,
      ...foldPaymentAdjustment(o),
    })
    .where(eq(order.id, orderId))
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: TAKE_OVER_NOTE(opts.author),
    author: opts.author,
    createdAt: now,
  })
  if (o.paymentAdjustmentPaise !== 0 && !keepsAdjustmentAsDiscount(o)) {
    await ctx.tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId,
      body: ADJUSTMENT_DROPPED_NOTE(o.paymentAdjustmentLabel),
      author: 'system',
      createdAt: now,
    })
  }
  return { id: orderId, cancelledAttempts: open.length }
}

type AdjustmentFields = Pick<
  typeof order.$inferSelect,
  | 'paymentAdjustmentPaise'
  | 'paymentAdjustmentLabel'
  | 'discountId'
  | 'discountCode'
  | 'discountLabel'
  | 'discountPaise'
  | 'totalPaise'
>

/** A payment-method discount (2% off for UPI) stays as the draft's own discount when no code holds that place. */
const keepsAdjustmentAsDiscount = (o: AdjustmentFields): boolean =>
  o.paymentAdjustmentPaise < 0 && !o.discountCode

/**
 * A staff draft prices lines, one discount and shipping (`draftMoney`), with no payment-method
 * fee or discount. So the checkout's adjustment leaves the row: a discount without a code beside
 * it joins the draft's manual discount (total unchanged); a fee, or a discount beside a code,
 * comes off the total, and a timeline line says so.
 */
export function foldPaymentAdjustment(o: AdjustmentFields): Partial<AdjustmentFields> {
  const adj = o.paymentAdjustmentPaise
  if (adj === 0) return {}
  const cleared = { paymentAdjustmentPaise: 0, paymentAdjustmentLabel: null }
  if (keepsAdjustmentAsDiscount(o)) {
    const labels = [o.discountPaise > 0 ? o.discountLabel : null, o.paymentAdjustmentLabel]
    return {
      ...cleared,
      // A manual discount from here on: the automatic one's use was given back above.
      discountId: null,
      discountPaise: o.discountPaise - adj,
      discountLabel: labels.filter(Boolean).join(' + ') || null,
    }
  }
  return { ...cleared, totalPaise: o.totalPaise - adj }
}
