import { cart, type Db, order, store, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { isAbroad } from '../checkout/address-abroad'
import {
  cartLimitBreach,
  checkCheckoutRules,
  checkoutRuleSubtotalPaise,
  parseCheckoutSettings,
} from '../checkout/settings'
import { assessCheckoutRisk } from '../cod-rto/risk'
import type { StoreContext } from '../context'
import { spendStoreCreditOnOrder } from '../customers/store-credit-checkout'
import { applyDiscount } from '../discounts/evaluate'
import { resolveCartDiscount } from '../discounts/resolve'
import {
  CartLimitExceeded,
  DiscountCodeRefused,
  NotLaunchedYet,
  PaymentMethodHidden,
  ShippingRateUnavailable,
  ShippingUnavailable,
} from '../errors'
import {
  GIFT_CARD_PROVIDER,
  GiftCardError,
  redeemGiftCards,
  reverseGiftCardRedemptions,
} from '../gift-cards/service'
import {
  createPaymentAttempt,
  startPaymentAttempt,
  startPaymentWithFallback,
} from '../payments/attempts'
import { hiddenPaymentMethods } from '../payments/method-rules'
import { GATEWAY_START_TIMEOUT_MS } from '../payments/routing'
import { parsePaymentSettings } from '../payments/settings'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { isLaunched } from '../preorder/launch'
import { priceOrderDelivery } from '../shipping/delivery-options/order'
import { lineShips } from '../shipping/profiles'
import { quoteProfileLines } from '../shipping/profiles-service'
import { runWorkflow, type WorkflowLog, type WorkflowStep } from '../workflow/run'
import { lockCartOrReplay } from './cart-replay'
import { clearOrderForAnotherMethod, orderAwaitingAnotherMethod } from './checkout-reopen'
import { enforceCheckoutRepeats } from './duplicate-checkout'
import { createOrder } from './place-order-create'
import { planCheckoutDraft, prepareDraft } from './place-order-draft'
import { loadCart, mixedCartOf } from './place-order-load'
import {
  chargeNowPaise,
  checkCheckoutPincode,
  paidByCards,
  splitTenderPaise,
  sumPaise,
} from './place-order-rules'
import type { DraftPlan, PlaceOrderInput, PlaceOrderResult, State } from './place-order-types'
import { recomputeOrderStatuses } from './recompute'
import { releaseReserved, routeAndReserve } from './routing-service'

export { checkGiftCardRules } from './place-order-rules'
// Re-exported from their sibling modules so callers keep this import path (#973).
export type { CheckoutDetails, PlaceOrderInput, PlaceOrderResult } from './place-order-types'

/** Nothing before `launchAt` can be added to a cart or ordered; server-enforced regardless of the client. */
const enforceLaunch: WorkflowStep<State> = {
  name: 'enforceLaunch',
  async run({ ctx, lines }) {
    const now = new Date()
    for (const line of lines) {
      if (!isLaunched(line.launchAt, now))
        throw new NotLaunchedYet(line.variantId, line.launchAt as Date, ctx.storeId)
    }
    return {}
  },
}

/**
 * Decide the discount inside the transaction, from the rules as they are now. A code the
 * shopper entered that does not work for this contact (one use per customer, customers only)
 * stops the order with `DiscountCodeRefused`: dropping it quietly charged the full price while
 * the summary still showed the discount (Razorpay asked for more than the page said).
 */
const resolveDiscount: WorkflowStep<State> = {
  name: 'resolveDiscount',
  async run({ ctx, input, cartDiscountCode, lines }) {
    if (lines.some((l) => l.giftCard)) return { discount: null }
    const code = input.discountCode === undefined ? cartDiscountCode : input.discountCode
    const { outcome, codeRejected } = await resolveCartDiscount(ctx, input.cartId, code, {
      email: input.checkout?.email,
      phone: input.checkout?.phone,
      stateCode: buyerStateOf(input.checkout),
    })
    if (code && codeRejected) throw new DiscountCodeRefused(code, codeRejected, ctx.storeId)
    return { discount: outcome }
  },
}

/**
 * Price shipping from the store's zones and rates, never from the client.
 * Bands and thresholds read the subtotal after the discount, the same number
 * the checkout preview used. A store with no zones ships free, as before
 * rates existed; a store with zones refuses an address none of them covers.
 */
const resolveShipping: WorkflowStep<State> = {
  name: 'resolveShipping',
  async run({ ctx, input, lines, discount: applied }) {
    const to = input.checkout?.address
    // Nothing to ship (gift cards, services, downloads): no charge, no option, no courier.
    if (!to || !lines.some(lineShips)) return { shipping: null }
    const { discountedSubtotalPaise } = applyDiscount(sumPaise(lines), 0, applied)
    // One rate per shipping profile in the cart, summed (rule in shipping/profiles.ts).
    const { quote } = await quoteProfileLines(ctx.tx, lines, discountedSubtotalPaise, {
      stateCode: to.stateCode,
      pincode: to.pincode,
      countryCode: to.countryCode,
    })
    // The Delivery options app quotes Indian couriers by PIN code; abroad prices by country zone.
    const fromApp =
      input.delivery && !isAbroad(to.countryCode)
        ? await priceOrderDelivery(ctx, input.delivery, {
            lines,
            valuePaise: discountedSubtotalPaise,
            zone: quote,
            payment: input.paymentProvider.id === 'cod' ? 'cod' : 'prepaid',
          })
        : null
    if (fromApp) return fromApp
    if (quote.kind === 'not_configured') return { shipping: null }
    if (quote.kind === 'no_rates') throw new ShippingUnavailable(to.pincode, ctx.storeId)
    const wanted = input.shippingRateId
    const picked = wanted ? quote.options.find((o) => o.rateId === wanted) : quote.options[0]
    if (!picked) throw new ShippingRateUnavailable(wanted ?? 'none', ctx.storeId)
    return { shipping: picked }
  },
}

/**
 * Settings → Checkout, enforced on the server whatever the form showed:
 * contact fields (email required or optional, a real mobile number, a valid
 * GSTIN, the note length), the minimum order, and the cash on delivery limits.
 * Runs before stock is reserved, so a refusal leaves nothing to undo.
 */
const enforceCheckoutRules: WorkflowStep<State> = {
  name: 'enforceCheckoutRules',
  async run({ ctx, input, lines, discount: applied, shipping, rewrite }) {
    const [s] = await ctx.tx
      .select({ preferences: store.preferences, payments: store.payments })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    const settings = parseCheckoutSettings(s?.preferences)
    // Cart limit (#156): a cart filled before the limit was set, or past the storefront, stops here.
    const over = cartLimitBreach(settings.cartLimit, lines)
    if (over) throw new CartLimitExceeded(over.productId, over.title, over.max, ctx.storeId)
    const { discountPaise, shippingPaise } = applyDiscount(
      sumPaise(lines),
      shipping?.pricePaise ?? 0,
      applied,
    )
    const ruleSubtotalPaise = checkoutRuleSubtotalPaise(lines, discountPaise)
    // Payment rules (#150): a way to pay the store hides for this order is refused here too.
    const payments = parsePaymentSettings(s?.payments)
    const hidden = hiddenPaymentMethods(payments.methodRules, {
      orderValuePaise: ruleSubtotalPaise + shippingPaise,
      pincode: input.checkout?.address.pincode ?? '',
      productIds: lines.map((l) => l.productId),
    })
    if (hidden.has(input.paymentProvider.id)) {
      throw new PaymentMethodHidden(input.paymentProvider.id, ctx.storeId)
    }
    const contact = checkCheckoutRules(settings, {
      checkout: input.checkout ?? null,
      paymentProviderId: input.paymentProvider.id,
      giftCardsOnly: lines.every((l) => l.giftCard),
      ruleSubtotalPaise,
      shippingPaise,
      storeId: ctx.storeId,
    })
    let draft: DraftPlan | null = null
    if (input.checkout) {
      const keys = {
        email: contact?.email ?? input.checkout.email,
        phone: contact?.phone ?? input.checkout.phone,
      }
      draft = await planCheckoutDraft(ctx, input, { contact: keys, lines, payments, rewrite })
      // The same checkout written again (another way to pay) is no repeat of itself.
      if (draft?.reuse || rewrite) return { contact, draft }
      // The same items again (unpaid: resume it; placed: ask), then the hourly cap.
      await enforceCheckoutRepeats(ctx, {
        contact: keys,
        lines,
        paymentMethod: input.paymentProvider.id,
        windowHours: payments.duplicateCheckoutHours,
        unpaidPerHour: payments.unpaidCheckoutsPerHour,
        orderAgain: input.orderAgain,
      })
      // No hard block on other unpaid orders (owner, 8 Nov 2026): the same items bring the
      // shopper back to their unpaid order above; anything else may be ordered.
    }
    return { contact, draft }
  },
}

/** COD & RTO app: score the order, and refuse COD when the store hides it for high risk. */
const assessRisk: WorkflowStep<State> = {
  name: 'assessRisk',
  async run({ ctx, input, lines, discount: applied, shipping, contact }) {
    const co = input.checkout
    if (!co || lines.every((l) => l.giftCard)) return { risk: null }
    const d = applyDiscount(sumPaise(lines), shipping?.pricePaise ?? 0, applied)
    const risk = await assessCheckoutRisk(ctx, {
      pincode: co.address.pincode,
      phone: contact?.phone ?? co.phone,
      email: contact ? contact.email : co.email,
      line1: co.address.line1,
      line2: co.address.line2,
      orderValuePaise: checkoutRuleSubtotalPaise(lines, d.discountPaise) + d.shippingPaise,
      paymentMethod: input.paymentProvider.id,
    })
    return { risk }
  },
}

/**
 * Route the goods to warehouses and hold their stock there (order/routing.ts). Pre-order lines
 * may sell past stock within their limit; untracked goods hold nothing. Gift cards are left out.
 */
const reserveStock: WorkflowStep<State> = {
  name: 'reserveStock',
  async run({ ctx, input, lines }) {
    const { parcels, reserved } = await routeAndReserve(ctx, {
      lines: lines.map((l, i) => ({
        key: String(i),
        variantId: l.variantId,
        quantity: l.quantity,
        giftCard: l.giftCard,
        preorder: l.preorder.enabled ? { enabled: true, limit: l.preorder.limit } : null,
      })),
      // Abroad there is no Indian state to route by (a composition GSTIN's limit is India's).
      buyerState: buyerStateOf(input.checkout),
    })
    // Mixed carts set to ship together (#143): every parcel waits with the pre-order, as a
    // pre-order parcel does (`on_hold`: ships when it arrives), so nothing goes out first.
    const verdict = mixedCartOf(lines)
    const together = verdict.kind === 'ok' && verdict.holdTogether
    return {
      parcels: together ? parcels.map((p) => ({ ...p, status: 'on_hold' as const })) : parcels,
      reserved,
    }
  },
  async compensate({ ctx, reserved }) {
    await releaseReserved(ctx, reserved)
  },
}

/**
 * Spend the applied gift cards against the total. Runs after the order exists
 * (payments reference it) and before the provider is charged, so the provider
 * only ever sees the remainder. COD cannot collect a remainder: a card spent on
 * a parcel that is then refused would sit locked until someone refunded it.
 */
const redeemCards: WorkflowStep<State> = {
  name: 'redeemGiftCards',
  async run({ ctx, input, orderId, totalPaise }) {
    const ids = input.giftCardIds ?? []
    if (!orderId || ids.length === 0) return {}
    const { redeemedPaise, redemptions } = await redeemGiftCards(ctx, {
      orderId,
      giftCardIds: ids,
      amountDuePaise: totalPaise,
    })
    if (redeemedPaise < totalPaise && input.paymentProvider.id === 'cod') {
      await reverseGiftCardRedemptions(ctx, redemptions)
      throw new GiftCardError(
        'not_allowed',
        'Cash on delivery cannot be used with a gift card. Pay the rest online.',
        ctx.storeId,
      )
    }
    return { giftCardPaise: redeemedPaise, redemptions }
  },
  async compensate({ ctx, redemptions }) {
    await reverseGiftCardRedemptions(ctx, redemptions)
  },
}

/**
 * Spend the signed-in shopper's store credit on what gift cards left of the amount due now
 * (`customers/store-credit-checkout.ts`). Covering it all, the credit is captured and no
 * provider is asked; otherwise it is held until the gateway is paid and given back if the order
 * is cancelled unpaid. Cash on delivery cannot collect a remainder, as with gift cards. Store
 * credit is a payment: the total, discount and GST were settled by `createOrder` and stay.
 * Everything here is in the checkout's transaction, so a later refusal undoes it.
 */
const spendStoreCredit: WorkflowStep<State> = {
  name: 'spendStoreCredit',
  async run({ ctx, input, lines, orderId, totalPaise, balanceDuePaise, giftCardPaise }) {
    const customerId = input.storeCredit?.customerId
    // Store credit never buys a gift card (it would turn the balance into a code anyone can
    // spend); checkout does not offer it on a gift card basket, so it is simply not used.
    if (!orderId || !customerId || lines.some((l) => l.giftCard)) return {}
    const spent = await spendStoreCreditOnOrder(ctx, {
      orderId,
      customerId,
      duePaise: chargeNowPaise({ totalPaise, balanceDuePaise }) - giftCardPaise,
      cover: input.paymentProvider.id === 'cod' ? 'all' : 'any',
    })
    return spent ? { storeCreditPaise: spent.amountPaise } : {}
  },
}

/**
 * Record the payment attempt, or settle the order when gift cards paid it all.
 * The gateway is not called here: this runs inside the transaction that holds
 * the stock reservations, so the call happens after commit
 * (`startPaymentAttempt`). Medusa orders its checkout steps the same way
 * (order first, payment last), and Saleor splits pre- and post-payment parts
 * of `complete_checkout` (patterns only: Medusa MIT, Saleor BSD-3).
 *
 * A deposit-mode pre-order only charges the deposit here (`chargeNowPaise`);
 * `order.balance_due_paise` carries what is left, and fulfilment refuses to
 * run while it is still owed (see `@commerce/core/order/fulfil`). Collecting
 * that balance is a later PR — this just charges the deposit and marks the
 * order paid-with-a-balance-due once the gateway captures it.
 */
const recordPaymentAttempt: WorkflowStep<State> = {
  name: 'recordPaymentAttempt',
  async run({ ctx, input, totalPaise, balanceDuePaise, giftCardPaise, storeCreditPaise, orderId }) {
    if (!orderId) throw new Error('recordPaymentAttempt before createOrder')
    const tender = { giftCardPaise, storeCreditPaise, totalPaise, balanceDuePaise }
    if (paidByCards(tender)) {
      await ctx.tx
        .update(order)
        .set({ paymentMethod: storeCreditPaise > 0 ? STORE_CREDIT_PROVIDER : GIFT_CARD_PROVIDER })
        .where(eq(order.id, orderId))
      // Paid entirely by gift cards and store credit: this never reaches applyPaymentStatus
      // (there is no gateway attempt), so the recompute here sees the captured
      // payments and writes order.paid.
      await recomputeOrderStatuses(ctx, orderId)
      return {}
    }
    const attempt = await createPaymentAttempt(ctx, {
      orderId,
      provider: input.paymentProvider.id,
      amountPaise: chargeNowPaise({ totalPaise, balanceDuePaise }) - splitTenderPaise(tender),
    })
    // A part paid by gift card shows as partially paid until the gateway captures; held store
    // credit counts once the gateway's capture captures it too.
    await recomputeOrderStatuses(ctx, orderId)
    return { attemptId: attempt.id }
  },
}

/** The Indian state an order goes to; null abroad, where `stateCode` holds the region. */
const buyerStateOf = (co: PlaceOrderInput['checkout']): string | null =>
  co && !isAbroad(co.address.countryCode) ? co.address.stateCode : null

const markCartConverted: WorkflowStep<State> = {
  name: 'markCartConverted',
  async run({ ctx, input }) {
    await ctx.tx.update(cart).set({ status: 'converted' }).where(eq(cart.id, input.cartId))
    return {}
  },
}

/**
 * Place an order from an open cart. Must run inside `withStore`; the caller's
 * transaction rolls back on throw. Reserves stock, creates the order and
 * records a `created` payment attempt, and never calls the gateway: start the
 * attempt after this transaction commits (`startPaymentAttempt`), or use
 * `placeOrderAndPay`, which does both.
 */
export async function placeOrder(
  ctx: StoreContext,
  input: PlaceOrderInput,
  log?: WorkflowLog,
): Promise<PlaceOrderResult> {
  const replay = await lockCartOrReplay(ctx, input.cartId)
  // The cart's order whose gateway refused the store's keys: placed again on the same row with
  // the way to pay the shopper picked now, never a second order (`order/checkout-reopen.ts`).
  const rewrite = replay ? await orderAwaitingAnotherMethod(ctx, { orderId: replay.orderId }) : null
  if (replay && !rewrite) return replay
  if (rewrite) await clearOrderForAnotherMethod(ctx, rewrite, input.cartId)
  // One spelling of the PIN code, and a state that agrees with it (place-order-rules.ts).
  if (input.checkout)
    input = { ...input, checkout: await checkCheckoutPincode(ctx.storeId, input.checkout) }
  const state = await runWorkflow<State>(
    {
      ctx,
      input,
      lines: [],
      cartDiscountCode: null,
      cartAttribution: null,
      cartTracking: null,
      discount: null,
      shipping: null,
      delivery: null,
      backupRateId: null,
      contact: null,
      parcels: [],
      reserved: [],
      orderId: null,
      orderNumber: null,
      totalPaise: 0,
      giftCardPaise: 0,
      redemptions: [],
      storeCreditPaise: 0,
      attemptId: null,
      depositPaise: 0,
      balanceDuePaise: 0,
      risk: null,
      draft: null,
      rewrite,
    },
    [
      loadCart,
      enforceLaunch,
      resolveDiscount,
      resolveShipping,
      enforceCheckoutRules,
      assessRisk,
      prepareDraft,
      reserveStock,
      createOrder,
      redeemCards,
      spendStoreCredit,
      recordPaymentAttempt,
      markCartConverted,
    ],
    log,
  )
  if (!state.orderId || state.orderNumber === null) {
    throw new Error('placeOrder finished without an order')
  }
  const byCards = !state.attemptId
  const settledBy = state.storeCreditPaise > 0 ? STORE_CREDIT_PROVIDER : GIFT_CARD_PROVIDER
  return {
    orderId: state.orderId,
    orderNumber: state.orderNumber,
    draftNumber: state.draft?.draftNumber ?? null,
    resumedDraft: !!state.draft?.reuse,
    attemptId: state.attemptId,
    paymentStatus: byCards ? 'captured' : 'created',
    session: byCards
      ? { kind: 'none', provider: settledBy, providerRef: `${settledBy}_${state.orderId}` }
      : null,
    replayed: false,
    depositPaise: state.depositPaise,
    balanceDuePaise: state.balanceDuePaise,
  }
}

export type PlacedAndPaid = PlaceOrderResult & {
  /** True when this call captured the money; drives the payment_received notification. */
  becameCaptured: boolean
  /** The gateway's error when the attempt could not be started; the order stays placed. */
  paymentError: string | null
  /**
   * The gateway refused the store's API keys and no fallback opened the payment: checkout
   * offers the shopper another way to pay on this same order (`order/checkout-reopen.ts`).
   */
  keysRefused: boolean
}

/**
 * `placeOrder` in its own transaction, then the payment attempt started with
 * the gateway after commit. A gateway failure leaves the order placed with its
 * stock held and the attempt `failed`, ready for "Retry payment".
 */
export async function placeOrderAndPay(
  db: Db,
  storeId: string,
  input: PlaceOrderInput,
  log?: WorkflowLog,
): Promise<PlacedAndPaid> {
  const placed = await withStore(db, storeId, (tx) => placeOrder({ storeId, tx }, input, log))
  if (!placed.attemptId || placed.paymentStatus !== 'created') {
    const byCards = !placed.replayed && placed.paymentStatus === 'captured'
    return { ...placed, becameCaptured: byCards, paymentError: null, keysRefused: false }
  }
  const fallbacks = input.paymentFallbacks ?? []
  const started = fallbacks.length
    ? await startPaymentWithFallback(
        db,
        storeId,
        placed.attemptId,
        input.paymentProvider,
        fallbacks,
        { timeoutMs: GATEWAY_START_TIMEOUT_MS },
      )
    : await startPaymentAttempt(db, storeId, placed.attemptId, input.paymentProvider)
  return {
    ...placed,
    paymentStatus: started.status,
    session: started.session ?? placed.session,
    becameCaptured: started.becameCaptured,
    paymentError: started.error,
    keysRefused: started.keysRefused === true && started.session == null,
  }
}
