import {
  address,
  cart,
  cartLine,
  customer,
  discount,
  discountUsage,
  inventoryLevel,
  type MarketingAttribution,
  order,
  orderLine,
  payment,
  product,
  sellableLevel,
  store,
  variant,
} from '@commerce/db'
import type {
  CheckoutSession,
  PaymentProvider,
  PaymentShipping,
  PaymentStatus,
} from '@commerce/payments'
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyDiscount } from '../discounts/evaluate'
import {
  customerUsageCount,
  type ResolvedDiscount,
  resolveCartDiscount,
} from '../discounts/resolve'
import { CartEmpty, CartNotOpen, DiscountUnavailable, OutOfStock, PaymentFailed } from '../errors'
import {
  GIFT_CARD_PROVIDER,
  GiftCardError,
  type GiftCardRedemption,
  redeemGiftCards,
  reverseGiftCardRedemptions,
} from '../gift-cards/service'
import { applyPaymentAdjustment } from '../payments/adjustments'
import { parsePaymentSettings } from '../payments/settings'
import { StoreAddressSchema } from '../settings/general'
import { computeOrderGst } from '../tax/gst'
import { runWorkflow, type WorkflowLog, type WorkflowStep } from '../workflow/run'

export type CheckoutDetails = {
  email: string
  phone: string
  name: string
  address: { line1: string; line2?: string; city: string; stateCode: string; pincode: string }
}

export type PlaceOrderInput = {
  cartId: string
  paymentProvider: PaymentProvider
  /** Optional in tests; required by the storefront checkout. */
  checkout?: CheckoutDetails
  /** Overrides the code saved on the cart; re-validated here regardless of what the client showed. */
  discountCode?: string | null
  /** Cards the shopper applied (ids from `findRedeemableGiftCard`), spent before the provider is charged. */
  giftCardIds?: readonly string[]
}
export type PlaceOrderResult = {
  orderId: string
  orderNumber: number
  paymentStatus: PaymentStatus
  /** How the storefront should continue: open a gateway checkout, redirect, or nothing. */
  session: CheckoutSession
  /** True when the cart was already converted and this is the order from that earlier submit. */
  replayed: boolean
}

type Line = {
  variantId: string
  quantity: number
  unitPricePaise: number
  title: string
  variantTitle: string
  /** The variant's own GST rate; null falls back to the store default. */
  gstRatePercent: number | null
  taxable: boolean
  hsCode: string | null
  /** Sold as a gift card: no tax, no stock, issued on payment. */
  giftCard: boolean
}

type State = {
  ctx: StoreContext
  input: PlaceOrderInput
  lines: Line[]
  cartDiscountCode: string | null
  /** The cart's marketing touch, copied onto the order for attribution. */
  cartAttribution: MarketingAttribution | null
  discount: ResolvedDiscount | null
  reserved: Line[]
  orderId: string | null
  orderNumber: number | null
  /** Order total: subtotal less discount, plus the payment-method fee or discount and shipping. */
  totalPaise: number
  /** Part of the total paid from gift cards; the provider is asked for the rest. */
  giftCardPaise: number
  redemptions: GiftCardRedemption[]
  providerRef: string | null
  paymentStatus: PaymentStatus | null
  session: CheckoutSession | null
}

const sumPaise = (lines: Line[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

const loadCart: WorkflowStep<State> = {
  name: 'loadCart',
  async run({ ctx, input }) {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, input.cartId))
    if (c?.status !== 'open') throw new CartNotOpen(input.cartId, ctx.storeId)
    const lines = await ctx.tx
      .select({
        variantId: cartLine.variantId,
        quantity: cartLine.quantity,
        unitPricePaise: cartLine.unitPricePaise,
        title: product.title,
        variantTitle: variant.title,
        gstRatePercent: variant.gstRatePercent,
        taxable: variant.taxable,
        hsCode: variant.hsCode,
        giftCard: product.isGiftCard,
      })
      .from(cartLine)
      .innerJoin(variant, eq(variant.id, cartLine.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(eq(cartLine.cartId, input.cartId))
    if (lines.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    checkGiftCardRules(lines, input, ctx.storeId)
    return { lines, cartDiscountCode: c.discountCode, cartAttribution: c.attribution ?? null }
  },
}

/**
 * Gift cards are vouchers, not goods: a card is checked out on its own, paid
 * online (no COD, and not with another gift card), and takes no discount, so
 * a code can never turn store credit into cash at a discount.
 */
export function checkGiftCardRules(
  lines: readonly Pick<Line, 'giftCard'>[],
  input: Pick<PlaceOrderInput, 'paymentProvider' | 'giftCardIds'>,
  storeId?: string,
): void {
  const buyingCards = lines.some((l) => l.giftCard)
  if (!buyingCards) return
  if (lines.some((l) => !l.giftCard)) {
    throw new GiftCardError(
      'not_allowed',
      'Gift cards are checked out on their own. Remove the other items or the gift card.',
      storeId,
    )
  }
  if (input.giftCardIds?.length) {
    throw new GiftCardError(
      'not_allowed',
      'Gift cards cannot be paid for with a gift card',
      storeId,
    )
  }
  if (input.paymentProvider.id === 'cod') {
    throw new GiftCardError('not_allowed', 'Gift cards need to be paid online', storeId)
  }
}

/**
 * Decide the discount inside the transaction, from the rules as they are now.
 * A code that stopped working since the shopper typed it is dropped (the best
 * automatic offer, if any, takes its place); the order is never blocked over it.
 */
const resolveDiscount: WorkflowStep<State> = {
  name: 'resolveDiscount',
  async run({ ctx, input, cartDiscountCode, lines }) {
    if (lines.some((l) => l.giftCard)) return { discount: null }
    const code = input.discountCode === undefined ? cartDiscountCode : input.discountCode
    const { outcome } = await resolveCartDiscount(ctx, input.cartId, code, {
      email: input.checkout?.email,
    })
    return { discount: outcome }
  },
}

const reserveStock: WorkflowStep<State> = {
  name: 'reserveStock',
  async run({ ctx, lines }) {
    const reserved: Line[] = []
    for (const line of lines) {
      // Untracked variants (made-to-order, digital) never run out: nothing to reserve.
      if (line.giftCard) continue
      const [v] = await ctx.tx
        .select({ trackInventory: variant.trackInventory })
        .from(variant)
        .where(eq(variant.id, line.variantId))
      if (v && !v.trackInventory) continue
      const rows = await ctx.tx
        .update(inventoryLevel)
        .set({ reserved: sql`${inventoryLevel.reserved} + ${line.quantity}` })
        .where(
          and(
            eq(inventoryLevel.variantId, line.variantId),
            sellableLevel,
            sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved} >= ${line.quantity}`,
          ),
        )
        .returning({ id: inventoryLevel.id })
      if (rows.length === 0) throw new OutOfStock(line.variantId, ctx.storeId)
      reserved.push(line)
    }
    return { reserved }
  },
  async compensate({ ctx, reserved }) {
    for (const line of reserved) {
      await ctx.tx
        .update(inventoryLevel)
        .set({ reserved: sql`${inventoryLevel.reserved} - ${line.quantity}` })
        .where(and(eq(inventoryLevel.variantId, line.variantId), sellableLevel))
    }
  },
}

const createOrder: WorkflowStep<State> = {
  name: 'createOrder',
  async run({ ctx, lines, input, discount: applied, cartAttribution }) {
    let customerId: string | null = null
    let shippingAddressId: string | null = null
    if (input.checkout) {
      const co = input.checkout
      const email = co.email.trim().toLowerCase()
      const defaultAddress = {
        name: co.name,
        line1: co.address.line1,
        line2: co.address.line2 ?? null,
        city: co.address.city,
        stateCode: co.address.stateCode,
        pincode: co.address.pincode,
        country: 'IN',
        phone: co.phone,
      }
      /* One customer per email per store; a repeat order refreshes name, phone and address. */
      const [cu] = await ctx.tx
        .insert(customer)
        .values({ storeId: ctx.storeId, email, phone: co.phone, name: co.name, defaultAddress })
        .onConflictDoUpdate({
          target: [customer.storeId, customer.email],
          set: { phone: co.phone, name: co.name, defaultAddress, updatedAt: new Date() },
        })
        .returning({ id: customer.id })
      const [ad] = await ctx.tx
        .insert(address)
        .values({
          storeId: ctx.storeId,
          name: co.name,
          line1: co.address.line1,
          line2: co.address.line2 ?? null,
          city: co.address.city,
          stateCode: co.address.stateCode,
          pincode: co.address.pincode,
          phone: co.phone,
        })
        .returning({ id: address.id })
      customerId = cu?.id ?? null
      shippingAddressId = ad?.id ?? null
    }
    const [s] = await ctx.tx
      .update(store)
      .set({ nextOrderNumber: sql`${store.nextOrderNumber} + 1` })
      .where(eq(store.id, ctx.storeId))
      .returning({
        next: store.nextOrderNumber,
        payments: store.payments,
        address: store.address,
        gstRatePercent: store.gstRatePercent,
      })
    if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
    const orderNumber = s.next - 1
    const subtotalPaise = sumPaise(lines)
    // Discount first, then the payment-method fee or discount on what is left.
    // Both are applied server-side here; the checkout preview is only a hint.
    const { discountPaise, shippingPaise, discountedSubtotalPaise } = applyDiscount(
      subtotalPaise,
      0,
      applied,
    )
    const adjustment = parsePaymentSettings(s.payments).adjustments[input.paymentProvider.id]
    const { adjustmentPaise, totalPaise: afterAdjustment } = applyPaymentAdjustment(
      discountedSubtotalPaise,
      adjustment,
    )
    const totalPaise = afterAdjustment + shippingPaise
    /* Listed prices include GST, so the tax is split out of the total rather
       than added to it; the shopper pays the same either way. */
    const storeAddress = StoreAddressSchema.safeParse(s.address ?? {})
    const tax = computeOrderGst({
      lines: lines.map((l) => ({
        grossPaise: l.quantity * l.unitPricePaise,
        ratePercent: lineGstRate(l, s.gstRatePercent),
      })),
      totalPaise,
      reductionPaise: discountPaise + Math.max(0, -adjustmentPaise),
      shipToState: input.checkout?.address.stateCode ?? null,
      storeState: storeAddress.success ? storeAddress.data.state : null,
    })
    const [o] = await ctx.tx
      .insert(order)
      .values({
        storeId: ctx.storeId,
        number: orderNumber,
        status: 'placed',
        subtotalPaise,
        taxPaise: tax.taxPaise,
        taxBreakdown: tax,
        shippingPaise,
        paymentAdjustmentPaise: adjustmentPaise,
        paymentAdjustmentLabel: adjustmentPaise ? (adjustment?.label ?? null) : null,
        discountId: applied?.discount.id ?? null,
        discountCode: applied?.discount.code ?? null,
        discountLabel: applied ? applied.label : null,
        discountPaise,
        totalPaise,
        customerId,
        shippingAddressId,
        email: input.checkout?.email ?? null,
        phone: input.checkout?.phone ?? null,
        paymentMethod: input.paymentProvider.id,
        attribution: cartAttribution,
        cartId: input.cartId,
      })
      .returning({ id: order.id })
    if (!o) throw new Error('order insert returned nothing')
    await ctx.tx.insert(orderLine).values(
      lines.map((l) => ({
        storeId: ctx.storeId,
        orderId: o.id,
        variantId: l.variantId,
        title: l.title,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        gstRatePercent: lineGstRate(l, s.gstRatePercent),
        hsCode: l.giftCard ? null : l.hsCode,
        giftCard: l.giftCard,
      })),
    )
    if (applied) {
      const email = input.checkout?.email.trim().toLowerCase() ?? null
      await claimDiscountUse(ctx, applied.discount.id, email)
      await ctx.tx.insert(discountUsage).values({
        storeId: ctx.storeId,
        discountId: applied.discount.id,
        orderId: o.id,
        customerId,
        email,
        amountPaise: discountPaise,
      })
    }
    return { orderId: o.id, orderNumber, totalPaise }
  },
  async compensate({ ctx, orderId, discount: applied }) {
    if (!orderId) return
    if (applied) {
      await ctx.tx.delete(discountUsage).where(eq(discountUsage.orderId, orderId))
      await ctx.tx
        .update(discount)
        .set({ usedCount: sql`greatest(${discount.usedCount} - 1, 0)` })
        .where(eq(discount.id, applied.discount.id))
    }
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    await ctx.tx.delete(order).where(eq(order.id, orderId))
  },
}

/**
 * Count one use of a discount, or throw `DiscountUnavailable` when it has run
 * out. `resolveDiscount` checked the limits from a snapshot, and a concurrent
 * checkout may have used the last redemption since. So the discount row is
 * locked for the rest of the transaction, the shopper's cap is re-counted under
 * that lock, and the increment only happens while `used_count` is under the
 * limit: a limit of 100 means 100 orders however many checkouts race.
 *
 * Pattern from Medusa's promotion `registerUsage` (MIT): lock the promotion
 * row, then re-check the limits under the lock.
 */
async function claimDiscountUse(
  ctx: StoreContext,
  discountId: string,
  email: string | null,
): Promise<void> {
  const [d] = await ctx.tx
    .select({ usagePerCustomer: discount.usagePerCustomer })
    .from(discount)
    .where(eq(discount.id, discountId))
    .for('update')
  if (!d) throw new DiscountUnavailable(discountId, ctx.storeId)
  if (d.usagePerCustomer !== null) {
    const uses = await customerUsageCount(ctx, discountId, email)
    if (uses >= d.usagePerCustomer) throw new DiscountUnavailable(discountId, ctx.storeId)
  }
  const claimed = await ctx.tx
    .update(discount)
    .set({ usedCount: sql`${discount.usedCount} + 1` })
    .where(
      and(
        eq(discount.id, discountId),
        or(isNull(discount.usageLimit), lt(discount.usedCount, discount.usageLimit)),
      ),
    )
    .returning({ id: discount.id })
  if (claimed.length === 0) throw new DiscountUnavailable(discountId, ctx.storeId)
}

/** GST at the line's rate; a gift card sale is a voucher, taxed only when it is redeemed. */
const lineGstRate = (l: Line, storeRate: number): number =>
  l.giftCard || !l.taxable ? 0 : (l.gstRatePercent ?? storeRate)

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

/** True when gift cards paid the whole order and no provider is involved. */
const paidByCards = (s: Pick<State, 'giftCardPaise' | 'totalPaise'>): boolean =>
  s.giftCardPaise > 0 && s.giftCardPaise >= s.totalPaise

function toPaymentShipping(co: CheckoutDetails): PaymentShipping {
  return {
    name: co.name,
    line1: co.address.line1,
    line2: co.address.line2,
    city: co.address.city,
    state: co.address.stateCode,
    postalCode: co.address.pincode,
    country: 'IN',
  }
}

/** External side effect only. Kept separate so a later DB failure still triggers the refund. */
const chargePayment: WorkflowStep<State> = {
  name: 'chargePayment',
  async run({ ctx, input, lines, orderId, orderNumber, totalPaise, giftCardPaise }) {
    if (!orderId) throw new Error('chargePayment before createOrder')
    if (paidByCards({ giftCardPaise, totalPaise })) {
      // Gift cards covered everything: nothing to ask the provider for.
      const providerRef = `gift_card_${orderId}`
      return {
        providerRef,
        paymentStatus: 'captured' as const,
        session: { kind: 'none' as const, provider: GIFT_CARD_PROVIDER, providerRef },
      }
    }
    try {
      const result = await input.paymentProvider.createPayment({
        orderId,
        orderNumber: orderNumber ?? undefined,
        amountPaise: totalPaise - giftCardPaise,
        currency: 'INR',
        customer: {
          email: input.checkout?.email,
          phone: input.checkout?.phone,
          name: input.checkout?.name,
        },
        shipping: input.checkout ? toPaymentShipping(input.checkout) : undefined,
        lines: lines.map((l) => ({
          title:
            l.variantTitle && l.variantTitle !== 'Default'
              ? `${l.title} / ${l.variantTitle}`
              : l.title,
          quantity: l.quantity,
          unitPricePaise: l.unitPricePaise,
        })),
      })
      return {
        providerRef: result.providerRef,
        paymentStatus: result.status,
        session: result.session,
      }
    } catch (cause) {
      throw new PaymentFailed(input.paymentProvider.id, cause, ctx.storeId)
    }
  },
  async compensate({ input, totalPaise, giftCardPaise, providerRef, paymentStatus }) {
    // Only money actually taken needs returning. providerRef doubles as the
    // payment id for providers that capture at creation.
    if (paidByCards({ giftCardPaise, totalPaise })) return
    if (providerRef && paymentStatus !== 'pending' && paymentStatus !== 'failed') {
      await input.paymentProvider.refund(providerRef, totalPaise - giftCardPaise)
    }
  },
}

const recordPayment: WorkflowStep<State> = {
  name: 'recordPayment',
  async run({
    ctx,
    input,
    totalPaise,
    giftCardPaise,
    orderId,
    providerRef,
    paymentStatus,
    session,
  }) {
    if (!orderId || !paymentStatus) throw new Error('recordPayment before chargePayment')
    if (paidByCards({ giftCardPaise, totalPaise })) {
      await ctx.tx
        .update(order)
        .set({ status: 'paid', paymentMethod: GIFT_CARD_PROVIDER })
        .where(eq(order.id, orderId))
      return {}
    }
    await ctx.tx.insert(payment).values({
      storeId: ctx.storeId,
      orderId,
      provider: input.paymentProvider.id,
      providerRef: providerRef as string,
      providerPaymentId: paymentStatus === 'captured' ? providerRef : null,
      checkoutSession: session,
      status: paymentStatus === 'authorized' ? 'pending' : paymentStatus,
      amountPaise: totalPaise - giftCardPaise,
    })
    if (paymentStatus === 'captured') {
      await ctx.tx.update(order).set({ status: 'paid' }).where(eq(order.id, orderId))
    }
    return {}
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
 * Lock the cart row until the transaction ends, so two submits of one cart (a
 * double tap, a retry on a flaky connection) run one after the other. The
 * second then finds the cart converted and gets the first order back, with the
 * same payment session, instead of placing a duplicate. The unique
 * `(store_id, cart_id)` index on `order` is the backstop.
 *
 * Pattern from Saleor's `create_order_from_checkout` (BSD-3): `select_for_update`
 * on the checkout, and `Order.checkout_token` to find the order on replay.
 */
async function lockCartOrReplay(
  ctx: StoreContext,
  cartId: string,
): Promise<PlaceOrderResult | null> {
  const [c] = await ctx.tx
    .select({ status: cart.status })
    .from(cart)
    .where(eq(cart.id, cartId))
    .for('update')
  if (c?.status !== 'converted') return null
  const [o] = await ctx.tx
    .select({ id: order.id, number: order.number, paymentMethod: order.paymentMethod })
    .from(order)
    .where(eq(order.cartId, cartId))
  // Converted before orders recorded their cart: nothing to replay.
  if (!o) return null
  const [p] = await ctx.tx
    .select({
      provider: payment.provider,
      providerRef: payment.providerRef,
      status: payment.status,
      checkoutSession: payment.checkoutSession,
    })
    .from(payment)
    .where(eq(payment.orderId, o.id))
    // Ids are uuidv7, so the newest payment sorts first.
    .orderBy(desc(payment.id))
    .limit(1)
  if (!p) {
    // Paid in full by gift cards: no provider payment was ever created.
    const providerRef = `gift_card_${o.id}`
    return {
      orderId: o.id,
      orderNumber: o.number,
      paymentStatus: 'captured',
      session: { kind: 'none', provider: o.paymentMethod ?? GIFT_CARD_PROVIDER, providerRef },
      replayed: true,
    }
  }
  const session = (p.checkoutSession as CheckoutSession | null) ?? {
    kind: 'none',
    provider: p.provider,
    providerRef: p.providerRef,
  }
  return {
    orderId: o.id,
    orderNumber: o.number,
    paymentStatus: p.status,
    session,
    replayed: true,
  }
}

/**
 * Place an order from an open cart. Must run inside `withStore`; the caller's
 * transaction rolls back on throw, and compensations additionally undo the
 * one side effect outside the database (a captured payment). `chargePayment`
 * and `recordPayment` are separate steps for exactly that reason.
 */
export async function placeOrder(
  ctx: StoreContext,
  input: PlaceOrderInput,
  log?: WorkflowLog,
): Promise<PlaceOrderResult> {
  const replay = await lockCartOrReplay(ctx, input.cartId)
  if (replay) return replay
  const state = await runWorkflow<State>(
    {
      ctx,
      input,
      lines: [],
      cartDiscountCode: null,
      cartAttribution: null,
      discount: null,
      reserved: [],
      orderId: null,
      orderNumber: null,
      totalPaise: 0,
      giftCardPaise: 0,
      redemptions: [],
      providerRef: null,
      paymentStatus: null,
      session: null,
    },
    [
      loadCart,
      resolveDiscount,
      reserveStock,
      createOrder,
      redeemCards,
      chargePayment,
      recordPayment,
      markCartConverted,
    ],
    log,
  )
  if (!state.orderId || state.orderNumber === null || !state.paymentStatus || !state.session) {
    throw new Error('placeOrder finished without an order')
  }
  return {
    orderId: state.orderId,
    orderNumber: state.orderNumber,
    paymentStatus: state.paymentStatus,
    session: state.session,
    replayed: false,
  }
}
