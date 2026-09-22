import {
  address,
  cart,
  cartLine,
  customer,
  discount,
  discountUsage,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
} from '@commerce/db'
import type {
  CheckoutSession,
  PaymentProvider,
  PaymentShipping,
  PaymentStatus,
} from '@commerce/payments'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyDiscount } from '../discounts/evaluate'
import { type ResolvedDiscount, resolveCartDiscount } from '../discounts/resolve'
import { CartEmpty, CartNotOpen, OutOfStock, PaymentFailed } from '../errors'
import { applyPaymentAdjustment } from '../payments/adjustments'
import { parsePaymentSettings } from '../payments/settings'
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
}
export type PlaceOrderResult = {
  orderId: string
  orderNumber: number
  paymentStatus: PaymentStatus
  /** How the storefront should continue: open a gateway checkout, redirect, or nothing. */
  session: CheckoutSession
}

type Line = {
  variantId: string
  quantity: number
  unitPricePaise: number
  title: string
  variantTitle: string
}

type State = {
  ctx: StoreContext
  input: PlaceOrderInput
  lines: Line[]
  cartDiscountCode: string | null
  discount: ResolvedDiscount | null
  reserved: Line[]
  orderId: string | null
  orderNumber: number | null
  /** Subtotal plus the payment-method fee or discount; what the provider is asked to charge. */
  totalPaise: number
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
      })
      .from(cartLine)
      .innerJoin(variant, eq(variant.id, cartLine.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(eq(cartLine.cartId, input.cartId))
    if (lines.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    return { lines, cartDiscountCode: c.discountCode }
  },
}

/**
 * Decide the discount inside the transaction, from the rules as they are now.
 * A code that stopped working since the shopper typed it is dropped (the best
 * automatic offer, if any, takes its place); the order is never blocked over it.
 */
const resolveDiscount: WorkflowStep<State> = {
  name: 'resolveDiscount',
  async run({ ctx, input, cartDiscountCode }) {
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
        .where(eq(inventoryLevel.variantId, line.variantId))
    }
  },
}

const createOrder: WorkflowStep<State> = {
  name: 'createOrder',
  async run({ ctx, lines, input, discount: applied }) {
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
      .returning({ next: store.nextOrderNumber, payments: store.payments })
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
    const [o] = await ctx.tx
      .insert(order)
      .values({
        storeId: ctx.storeId,
        number: orderNumber,
        status: 'placed',
        subtotalPaise,
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
      })),
    )
    if (applied) {
      // Usage is counted in the same transaction as the order, so a limit of
      // 100 means 100 orders even under concurrent checkouts.
      await ctx.tx.insert(discountUsage).values({
        storeId: ctx.storeId,
        discountId: applied.discount.id,
        orderId: o.id,
        customerId,
        email: input.checkout?.email.trim().toLowerCase() ?? null,
        amountPaise: discountPaise,
      })
      await ctx.tx
        .update(discount)
        .set({ usedCount: sql`${discount.usedCount} + 1` })
        .where(eq(discount.id, applied.discount.id))
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
  async run({ ctx, input, lines, orderId, orderNumber, totalPaise }) {
    if (!orderId) throw new Error('chargePayment before createOrder')
    try {
      const result = await input.paymentProvider.createPayment({
        orderId,
        orderNumber: orderNumber ?? undefined,
        amountPaise: totalPaise,
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
  async compensate({ input, totalPaise, providerRef, paymentStatus }) {
    // Only money actually taken needs returning. providerRef doubles as the
    // payment id for providers that capture at creation.
    if (providerRef && paymentStatus !== 'pending' && paymentStatus !== 'failed') {
      await input.paymentProvider.refund(providerRef, totalPaise)
    }
  },
}

const recordPayment: WorkflowStep<State> = {
  name: 'recordPayment',
  async run({ ctx, input, totalPaise, orderId, providerRef, paymentStatus, session }) {
    if (!orderId || !paymentStatus) throw new Error('recordPayment before chargePayment')
    await ctx.tx.insert(payment).values({
      storeId: ctx.storeId,
      orderId,
      provider: input.paymentProvider.id,
      providerRef: providerRef as string,
      providerPaymentId: paymentStatus === 'captured' ? providerRef : null,
      checkoutSession: session,
      status: paymentStatus === 'authorized' ? 'pending' : paymentStatus,
      amountPaise: totalPaise,
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
  const state = await runWorkflow<State>(
    {
      ctx,
      input,
      lines: [],
      cartDiscountCode: null,
      discount: null,
      reserved: [],
      orderId: null,
      orderNumber: null,
      totalPaise: 0,
      providerRef: null,
      paymentStatus: null,
      session: null,
    },
    [
      loadCart,
      resolveDiscount,
      reserveStock,
      createOrder,
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
  }
}
