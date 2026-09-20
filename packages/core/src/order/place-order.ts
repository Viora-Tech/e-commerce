import { cart, cartLine, inventoryLevel, order, orderLine, payment, store } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CartEmpty, CartNotOpen, OutOfStock, PaymentFailed } from '../errors'
import type { PaymentProvider, PaymentStatus } from '../providers/payment'
import { runWorkflow, type WorkflowStep } from '../workflow/run'

export type PlaceOrderInput = { cartId: string; paymentProvider: PaymentProvider }
export type PlaceOrderResult = {
  orderId: string
  orderNumber: number
  paymentStatus: PaymentStatus
}

type Line = { variantId: string; quantity: number; unitPricePaise: number }

type State = {
  ctx: StoreContext
  input: PlaceOrderInput
  lines: Line[]
  reserved: Line[]
  orderId: string | null
  orderNumber: number | null
  providerRef: string | null
  paymentStatus: PaymentStatus | null
}

const sumPaise = (lines: Line[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

const loadCart: WorkflowStep<State> = {
  name: 'loadCart',
  async run({ ctx, input }) {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, input.cartId))
    if (!c || c.status !== 'open') throw new CartNotOpen(input.cartId, ctx.storeId)
    const lines = await ctx.tx
      .select({
        variantId: cartLine.variantId,
        quantity: cartLine.quantity,
        unitPricePaise: cartLine.unitPricePaise,
      })
      .from(cartLine)
      .where(eq(cartLine.cartId, input.cartId))
    if (lines.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    return { lines }
  },
}

const reserveStock: WorkflowStep<State> = {
  name: 'reserveStock',
  async run({ ctx, lines }) {
    const reserved: Line[] = []
    for (const line of lines) {
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
  async run({ ctx, lines }) {
    const [s] = await ctx.tx
      .update(store)
      .set({ nextOrderNumber: sql`${store.nextOrderNumber} + 1` })
      .where(eq(store.id, ctx.storeId))
      .returning({ next: store.nextOrderNumber })
    if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
    const orderNumber = s.next - 1
    const subtotalPaise = sumPaise(lines)
    const [o] = await ctx.tx
      .insert(order)
      .values({
        storeId: ctx.storeId,
        number: orderNumber,
        status: 'placed',
        subtotalPaise,
        totalPaise: subtotalPaise,
      })
      .returning({ id: order.id })
    if (!o) throw new Error('order insert returned nothing')
    await ctx.tx.insert(orderLine).values(
      lines.map((l) => ({
        storeId: ctx.storeId,
        orderId: o.id,
        variantId: l.variantId,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
      })),
    )
    return { orderId: o.id, orderNumber }
  },
  async compensate({ ctx, orderId }) {
    if (!orderId) return
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    await ctx.tx.delete(order).where(eq(order.id, orderId))
  },
}

const createPayment: WorkflowStep<State> = {
  name: 'createPayment',
  async run({ ctx, input, lines, orderId }) {
    if (!orderId) throw new Error('createPayment before createOrder')
    const amountPaise = sumPaise(lines)
    let result: { providerRef: string; status: PaymentStatus }
    try {
      result = await input.paymentProvider.createPayment(ctx, {
        orderId,
        amountPaise,
        customer: {},
      })
    } catch (cause) {
      throw new PaymentFailed(input.paymentProvider.id, cause, ctx.storeId)
    }
    await ctx.tx.insert(payment).values({
      storeId: ctx.storeId,
      orderId,
      provider: input.paymentProvider.id,
      providerRef: result.providerRef,
      status: result.status,
      amountPaise,
    })
    if (result.status === 'captured') {
      await ctx.tx.update(order).set({ status: 'paid' }).where(eq(order.id, orderId))
    }
    return { providerRef: result.providerRef, paymentStatus: result.status }
  },
  async compensate({ ctx, input, lines, providerRef, paymentStatus }) {
    if (providerRef && paymentStatus === 'captured') {
      await input.paymentProvider.refund(ctx, providerRef, sumPaise(lines))
    }
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
 * one side effect outside the database (a captured payment).
 */
export async function placeOrder(
  ctx: StoreContext,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const state = await runWorkflow<State>(
    {
      ctx,
      input,
      lines: [],
      reserved: [],
      orderId: null,
      orderNumber: null,
      providerRef: null,
      paymentStatus: null,
    },
    [loadCart, reserveStock, createOrder, createPayment, markCartConverted],
  )
  if (!state.orderId || state.orderNumber === null || !state.paymentStatus) {
    throw new Error('placeOrder finished without an order')
  }
  return {
    orderId: state.orderId,
    orderNumber: state.orderNumber,
    paymentStatus: state.paymentStatus,
  }
}
