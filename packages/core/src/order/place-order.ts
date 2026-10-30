import { cart, cartLine, type Db, order, product, store, variant, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import {
  checkCheckoutRules,
  checkoutRuleSubtotalPaise,
  parseCheckoutSettings,
} from '../checkout/settings'
import { assessCheckoutRisk } from '../cod-rto/risk'
import type { StoreContext } from '../context'
import { applyDiscount } from '../discounts/evaluate'
import { resolveCartDiscount } from '../discounts/resolve'
import {
  CartEmpty,
  CartNotOpen,
  DiscountCodeRefused,
  NotLaunchedYet,
  NotSoldInMarket,
  PriceNotSet,
  ShippingRateUnavailable,
  ShippingUnavailable,
  VariantHidden,
} from '../errors'
import {
  GIFT_CARD_PROVIDER,
  GiftCardError,
  redeemGiftCards,
  reverseGiftCardRedemptions,
} from '../gift-cards/service'
import { unsoldInMarket } from '../markets/catalogs'
import {
  createPaymentAttempt,
  startPaymentAttempt,
  startPaymentWithFallback,
} from '../payments/attempts'
import { GATEWAY_START_TIMEOUT_MS } from '../payments/routing'
import { isLaunched } from '../preorder/launch'
import { resolvePreorderSettings } from '../preorder/settings'
import { priceOrderDelivery } from '../shipping/delivery-options/order'
import { quoteProfileLines } from '../shipping/profiles-service'
import { runWorkflow, type WorkflowLog, type WorkflowStep } from '../workflow/run'
import { lockCartOrReplay } from './cart-replay'
import { createOrder } from './place-order-create'
import {
  chargeNowPaise,
  checkCheckoutPincode,
  checkGiftCardRules,
  paidByCards,
  sumPaise,
} from './place-order-rules'
import type { Line, PlaceOrderInput, PlaceOrderResult, State } from './place-order-types'
import { recomputeOrderStatuses } from './recompute'
import { releaseReserved, routeAndReserve } from './routing-service'

export { checkGiftCardRules } from './place-order-rules'
// Re-exported from their sibling modules so callers keep this import path (#973).
export type { CheckoutDetails, PlaceOrderInput, PlaceOrderResult } from './place-order-types'

const loadCart: WorkflowStep<State> = {
  name: 'loadCart',
  async run({ ctx, input }) {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, input.cartId))
    if (c?.status !== 'open') throw new CartNotOpen(input.cartId, ctx.storeId)
    const rows = await ctx.tx
      .select({
        variantId: cartLine.variantId,
        productId: product.id,
        quantity: cartLine.quantity,
        unitPricePaise: cartLine.unitPricePaise,
        variantPricePaise: variant.pricePaise,
        hiddenOnStore: variant.hiddenOnStore,
        title: product.title,
        variantTitle: variant.title,
        gstRatePercent: variant.gstRatePercent,
        taxable: variant.taxable,
        hsCode: variant.hsCode,
        giftCard: product.isGiftCard,
        weightGrams: variant.weightGrams,
        costPaise: variant.costPaise,
        launchAt: product.launchAt,
        preorderOverride: variant.preorderOverride,
        preorderEnabled: product.preorderEnabled,
        preorderShipDate: product.preorderShipDate,
        preorderShipsInDays: product.preorderShipsInDays,
        preorderLimit: product.preorderLimit,
        preorderButtonLabel: product.preorderButtonLabel,
        preorderNote: product.preorderNote,
        preorderPaymentMode: product.preorderPaymentMode,
        preorderDepositPaise: product.preorderDepositPaise,
        preorderDepositPercent: product.preorderDepositPercent,
      })
      .from(cartLine)
      .innerJoin(variant, eq(variant.id, cartLine.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(eq(cartLine.cartId, input.cartId))
    if (rows.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    // The cart snapshots the price, but a price withdrawn since (#913) stops the order.
    const unpriced = rows.find((r) => r.variantPricePaise == null)
    if (unpriced) throw new PriceNotSet(unpriced.variantId, ctx.storeId)
    // Hidden after it went into the cart (#934): the shopper can no longer buy it.
    const hidden = rows.find((r) => r.hiddenOnStore)
    if (hidden) throw new VariantHidden(hidden.variantId, ctx.storeId)
    // The cart's market sells from a catalog that leaves it out (Markets › Catalogs).
    const unsold = new Set(
      await unsoldInMarket(
        ctx.tx,
        c.marketId,
        rows.map((r) => r.productId),
      ),
    )
    const outside = rows.find((r) => unsold.has(r.productId))
    if (outside) throw new NotSoldInMarket(outside.variantId, ctx.storeId)
    const lines: Line[] = rows.map((r) => ({
      variantId: r.variantId,
      productId: r.productId,
      quantity: r.quantity,
      unitPricePaise: r.unitPricePaise,
      title: r.title,
      variantTitle: r.variantTitle,
      gstRatePercent: r.gstRatePercent,
      taxable: r.taxable,
      hsCode: r.hsCode,
      giftCard: r.giftCard,
      weightGrams: r.weightGrams,
      costPaise: r.costPaise,
      launchAt: r.launchAt,
      preorder: resolvePreorderSettings(r, r.preorderOverride),
      preorderNote: r.preorderNote,
    }))
    checkGiftCardRules(lines, input, ctx.storeId)
    return {
      lines,
      cartDiscountCode: c.discountCode,
      cartAttribution: c.attribution ?? null,
      cartTracking: c.tracking ?? null,
    }
  },
}

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
      stateCode: input.checkout?.address?.stateCode,
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
    if (!to || lines.every((l) => l.giftCard)) return { shipping: null }
    const { discountedSubtotalPaise } = applyDiscount(sumPaise(lines), 0, applied)
    // One rate per shipping profile in the cart, summed (rule in shipping/profiles.ts).
    const { quote } = await quoteProfileLines(ctx.tx, lines, discountedSubtotalPaise, {
      stateCode: to.stateCode,
      pincode: to.pincode,
      countryCode: to.countryCode,
    })
    const fromApp = input.delivery
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
  async run({ ctx, input, lines, discount: applied, shipping }) {
    const [s] = await ctx.tx
      .select({ preferences: store.preferences })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    const settings = parseCheckoutSettings(s?.preferences)
    const { discountPaise, shippingPaise } = applyDiscount(
      sumPaise(lines),
      shipping?.pricePaise ?? 0,
      applied,
    )
    return {
      contact: checkCheckoutRules(settings, {
        checkout: input.checkout ?? null,
        paymentProviderId: input.paymentProvider.id,
        giftCardsOnly: lines.every((l) => l.giftCard),
        ruleSubtotalPaise: checkoutRuleSubtotalPaise(lines, discountPaise),
        shippingPaise,
        storeId: ctx.storeId,
      }),
    }
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
      buyerState: input.checkout?.address.stateCode ?? null,
    })
    return { parcels, reserved }
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
  async run({ ctx, input, totalPaise, balanceDuePaise, giftCardPaise, orderId }) {
    if (!orderId) throw new Error('recordPaymentAttempt before createOrder')
    if (paidByCards({ giftCardPaise, totalPaise, balanceDuePaise })) {
      await ctx.tx
        .update(order)
        .set({ paymentMethod: GIFT_CARD_PROVIDER })
        .where(eq(order.id, orderId))
      // Paid entirely by gift cards: this never reaches applyPaymentStatus
      // (there is no gateway attempt), so the recompute here sees the captured
      // card payments and writes order.paid.
      await recomputeOrderStatuses(ctx, orderId)
      return {}
    }
    const attempt = await createPaymentAttempt(ctx, {
      orderId,
      provider: input.paymentProvider.id,
      amountPaise: chargeNowPaise({ totalPaise, balanceDuePaise }) - giftCardPaise,
    })
    // A part paid by gift card shows as partially paid until the gateway captures.
    await recomputeOrderStatuses(ctx, orderId)
    return { attemptId: attempt.id }
  },
}

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
  if (replay) return replay
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
      attemptId: null,
      depositPaise: 0,
      balanceDuePaise: 0,
      risk: null,
    },
    [
      loadCart,
      enforceLaunch,
      resolveDiscount,
      resolveShipping,
      enforceCheckoutRules,
      assessRisk,
      reserveStock,
      createOrder,
      redeemCards,
      recordPaymentAttempt,
      markCartConverted,
    ],
    log,
  )
  if (!state.orderId || state.orderNumber === null) {
    throw new Error('placeOrder finished without an order')
  }
  const byCards = !state.attemptId
  return {
    orderId: state.orderId,
    orderNumber: state.orderNumber,
    attemptId: state.attemptId,
    paymentStatus: byCards ? 'captured' : 'created',
    session: byCards
      ? { kind: 'none', provider: GIFT_CARD_PROVIDER, providerRef: `gift_card_${state.orderId}` }
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
    return { ...placed, becameCaptured: byCards, paymentError: null }
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
  }
}
