/** SOURCE OF TRUTH: tests for "Edit" on a checkout draft — WHAT: the take-over keeps the shopper's checkout as a staff draft, stops every payment try, refuses while money is in or on its way, and refunds a late payment on the old link / WHY: the old link must never charge the old amount for an edited draft */
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  orderNote,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { PaymentStatus } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { retryPayment } from '../payments/attempts'
import {
  applyPaymentStatus,
  TAKEN_OVER_ATTEMPT_ERROR,
  TAKEN_OVER_PAYMENT_NOTE,
} from '../payments/confirm'
import { GatewayDouble } from '../payments/gateway-double.test-util'
import {
  CheckoutDraftNotTakeable,
  foldPaymentAdjustment,
  TAKE_OVER_NOTE,
  type TakeOverRefusal,
  takeOverCheckoutDraft,
} from './checkout-draft-take-over'
import { convertDraft } from './drafts'
import { placeOrderAndPay } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const STAFF = 'priya@waimers.test'

type Shop = { storeId: string; orderId: string; gateway: GatewayDouble }

async function checkoutDraft(): Promise<Shop> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'waimers', name: 'Waimers', payments: { unpaidAsDrafts: 'on' } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'keyboard', title: 'Keyboard', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Keyboard', pricePaise: 250000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId: s.id, cartId: c.id, variantId: v.id, quantity: 1, unitPricePaise: 250000 })
  const gateway = new GatewayDouble()
  const r = await placeOrderAndPay(app, s.id, {
    cartId: c.id,
    paymentProvider: gateway,
    checkout: {
      name: 'Rudra',
      email: 'rudra@example.com',
      phone: '9876543210',
      address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
    },
  })
  const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
  expect(o).toMatchObject({ status: 'draft', draftSource: 'checkout' })
  return { storeId: s.id, orderId: r.orderId, gateway }
}

const takeOver = (shop: Shop) =>
  withStore(app, shop.storeId, (tx) =>
    takeOverCheckoutDraft({ storeId: shop.storeId, tx }, shop.orderId, {
      author: STAFF,
      providers: [shop.gateway],
    }),
  )

async function refusedWith(shop: Shop, reason: TakeOverRefusal) {
  const err = await takeOver(shop).catch((e: unknown) => e)
  expect(err).toBeInstanceOf(CheckoutDraftNotTakeable)
  expect((err as CheckoutDraftNotTakeable).reason).toBe(reason)
}

const orderRow = async (id: string) => (await owner.select().from(order).where(eq(order.id, id)))[0]
const attemptsOf = (orderId: string) =>
  owner.select().from(payment).where(eq(payment.orderId, orderId))

/** The webhook for the shopper's first gateway try. */
async function gatewayReports(shop: Shop, status: PaymentStatus) {
  const [a] = await attemptsOf(shop.orderId)
  if (!a) throw new Error('no attempt')
  return withStore(app, shop.storeId, (tx) =>
    applyPaymentStatus(
      { storeId: shop.storeId, tx },
      { paymentId: a.id, status, providerPaymentId: `pay_${a.id}` },
    ),
  )
}

describe('Edit on an unpaid checkout draft', () => {
  it('becomes a staff draft with the same shopper, items and sale source, and stops the link', async () => {
    const shop = await checkoutDraft()
    await owner
      .update(order)
      .set({ attribution: { source: 'instagram' } as never })
      .where(eq(order.id, shop.orderId))
    const before = await orderRow(shop.orderId)

    expect(await takeOver(shop)).toEqual({ id: shop.orderId, cancelledAttempts: 1 })

    const after = await orderRow(shop.orderId)
    expect(after).toMatchObject({
      status: 'draft',
      draftSource: 'staff',
      draftNumber: before?.draftNumber,
      email: 'rudra@example.com',
      phone: '9876543210',
      shippingAddressId: before?.shippingAddressId,
      totalPaise: before?.totalPaise,
      shippingPaise: before?.shippingPaise,
      attribution: { source: 'instagram' },
    })
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, shop.orderId))
    expect(lines).toHaveLength(1)
    const attempts = await attemptsOf(shop.orderId)
    expect(attempts.every((a) => a.status === 'cancelled')).toBe(true)
    expect(attempts.every((a) => a.error?.startsWith(TAKEN_OVER_ATTEMPT_ERROR))).toBe(true)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, shop.orderId))
    expect(notes.map((n) => n.body)).toContain(TAKE_OVER_NOTE(STAFF))
    // The old link's page cannot start a new payment.
    await expect(
      withStore(app, shop.storeId, (tx) =>
        retryPayment({ storeId: shop.storeId, tx }, shop.orderId),
      ),
    ).rejects.toThrow(/cannot take a new payment/)
  })

  it('refuses a second take-over: it is a staff draft now', async () => {
    const shop = await checkoutDraft()
    await takeOver(shop)
    await refusedWith(shop, 'not_checkout')
  })

  it('refuses when the gateway says the payment went through, and changes nothing', async () => {
    const shop = await checkoutDraft()
    const [a] = await attemptsOf(shop.orderId)
    shop.gateway.status.set(a?.providerRef as string, 'captured')
    await refusedWith(shop, 'in_progress')
    expect(await orderRow(shop.orderId)).toMatchObject({ draftSource: 'checkout' })
    expect((await attemptsOf(shop.orderId))[0]?.status).not.toBe('cancelled')
  })

  it('refuses when an authorised payment is on it', async () => {
    const shop = await checkoutDraft()
    const [a] = await attemptsOf(shop.orderId)
    await owner
      .update(payment)
      .set({ status: 'authorized' })
      .where(eq(payment.id, a?.id as string))
    await refusedWith(shop, 'in_progress')
  })

  it('refuses when money was captured on it', async () => {
    const shop = await checkoutDraft()
    const [a] = await attemptsOf(shop.orderId)
    await owner
      .update(payment)
      .set({ status: 'captured', refundNeeded: true })
      .where(eq(payment.id, a?.id as string))
    await refusedWith(shop, 'paid')
  })

  it('refuses when the gateway cannot be asked', async () => {
    const shop = await checkoutDraft()
    shop.gateway.fetchFails = true
    await refusedWith(shop, 'unchecked')
    expect(await orderRow(shop.orderId)).toMatchObject({ draftSource: 'checkout' })
  })

  it('refunds a payment made on the old link after the take-over, never marking the draft paid', async () => {
    const shop = await checkoutDraft()
    await takeOver(shop)
    const applied = await gatewayReports(shop, 'captured')
    expect(applied).toMatchObject({ refundNeeded: true, becameCaptured: false })
    expect(await orderRow(shop.orderId)).toMatchObject({ status: 'draft', draftSource: 'staff' })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, shop.orderId))
    expect(notes.map((n) => n.body)).toContain(TAKEN_OVER_PAYMENT_NOTE)
  })

  it('refunds an old-link payment that lands after staff converted the draft', async () => {
    const shop = await checkoutDraft()
    await takeOver(shop)
    await withStore(app, shop.storeId, (tx) =>
      convertDraft({ storeId: shop.storeId, tx }, shop.orderId, { paymentMethod: 'manual' }),
    )
    const applied = await gatewayReports(shop, 'captured')
    expect(applied).toMatchObject({ refundNeeded: true, becameCaptured: false })
    expect((await orderRow(shop.orderId))?.checkoutPaidAt).toBeNull()
  })
})

describe('foldPaymentAdjustment', () => {
  const base = {
    paymentAdjustmentPaise: 0,
    paymentAdjustmentLabel: null,
    discountId: null,
    discountCode: null,
    discountLabel: null,
    discountPaise: 0,
    totalPaise: 98000,
  }

  it('leaves a checkout without a payment-method fee or discount alone', () => {
    expect(foldPaymentAdjustment(base)).toEqual({})
  })

  it('keeps a payment-method discount as the draft discount, total unchanged', () => {
    expect(
      foldPaymentAdjustment({
        ...base,
        paymentAdjustmentPaise: -2000,
        paymentAdjustmentLabel: '2% off UPI',
      }),
    ).toEqual({
      paymentAdjustmentPaise: 0,
      paymentAdjustmentLabel: null,
      discountId: null,
      discountPaise: 2000,
      discountLabel: '2% off UPI',
    })
  })

  it('takes a fee, or a method discount beside a code, off the total', () => {
    expect(foldPaymentAdjustment({ ...base, paymentAdjustmentPaise: 1500 })).toMatchObject({
      paymentAdjustmentPaise: 0,
      totalPaise: 96500,
    })
    expect(
      foldPaymentAdjustment({
        ...base,
        discountCode: 'DIWALI',
        discountPaise: 5000,
        paymentAdjustmentPaise: -2000,
      }),
    ).toMatchObject({ paymentAdjustmentPaise: 0, totalPaise: 100000 })
  })
})
