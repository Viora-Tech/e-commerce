import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  payment,
  paymentEvent,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrder, placeOrderAndPay } from '../order/place-order'
import { cancelOrder } from '../order/status'
import { PaymentNotRetryable, retryAndStartPayment, retryPayment } from './attempts'
import { type Delivery, GatewayDouble } from './gateway-double.test-util'
import { handlePaymentWebhook } from './webhook'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedCart(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: 1,
    unitPricePaise: 10000,
  })
  return { storeId: s.id, cartId: c.id, variantId: v.id }
}

async function placed(gw: GatewayDouble, slug?: string) {
  const { storeId, cartId, variantId } = await seedCart(slug)
  const r = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: gw })
  return { storeId, variantId, ...r }
}

const deliver = (storeId: string, gw: GatewayDouble, d: Delivery) =>
  withStore(app, storeId, (tx) =>
    handlePaymentWebhook({ storeId, tx }, gw, {
      rawBody: JSON.stringify(d),
      headers: { sig: 'ok' },
    }),
  )

const attemptsOf = (orderId: string) =>
  owner.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(payment.attempt)

const orderRow = async (orderId: string) =>
  (await owner.select().from(order).where(eq(order.id, orderId)))[0]

describe('payment attempts', () => {
  it('sends the attempt key to the gateway and records the session after commit', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    expect(gw.created).toHaveLength(1)
    expect(gw.created[0]?.idempotencyKey).toBe(`${r.orderId}:1`)
    const [a] = await attemptsOf(r.orderId)
    expect(a).toMatchObject({ status: 'pending', providerRef: 'order_1', attempt: 1 })
    expect(a?.gatewayRequestedAt).not.toBeNull()
    expect(r.session?.kind).toBe('client')
  })

  it('retry makes a new attempt on the same order; a double tap makes one', async () => {
    const gw = new GatewayDouble()
    gw.failNext = true
    const r = await placed(gw)
    expect(r.paymentStatus).toBe('failed')

    const [one, two] = await Promise.all([
      withStore(app, r.storeId, (tx) => retryPayment({ storeId: r.storeId, tx }, r.orderId)),
      withStore(app, r.storeId, (tx) => retryPayment({ storeId: r.storeId, tx }, r.orderId)),
    ])
    expect([one.created, two.created].sort()).toEqual([false, true])
    expect(one.attempt.id).toBe(two.attempt.id)

    const started = await retryAndStartPayment(app, r.storeId, r.orderId, gw)
    expect(started).toMatchObject({ status: 'pending', attemptId: one.attempt.id })
    const rows = await attemptsOf(r.orderId)
    expect(rows.map((p) => [p.attempt, p.status, p.idempotencyKey])).toEqual([
      [1, 'failed', `${r.orderId}:1`],
      [2, 'pending', `${r.orderId}:2`],
    ])
    expect(gw.created.map((c) => c.idempotencyKey)).toEqual([`${r.orderId}:2`])
    expect((await orderRow(r.orderId))?.paymentStatus).toBe('unpaid')
  })

  it('refuses a retry once the order is paid or cancelled', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    await deliver(r.storeId, gw, {
      eventId: 'e1',
      type: 'payment.captured',
      providerRef: 'order_1',
    })
    await expect(
      withStore(app, r.storeId, (tx) => retryPayment({ storeId: r.storeId, tx }, r.orderId)),
    ).rejects.toBeInstanceOf(PaymentNotRetryable)

    const other = await placed(gw, 'x')
    await withStore(app, other.storeId, (tx) =>
      cancelOrder({ storeId: other.storeId, tx }, other.orderId),
    )
    await expect(
      withStore(app, other.storeId, (tx) =>
        retryPayment({ storeId: other.storeId, tx }, other.orderId),
      ),
    ).rejects.toBeInstanceOf(PaymentNotRetryable)
  })
})

describe('idempotent webhooks', () => {
  it('two concurrent deliveries of one event apply it once', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    const d: Delivery = { eventId: 'evt_1', type: 'payment.captured', providerRef: 'order_1' }

    const outcomes = await Promise.all([deliver(r.storeId, gw, d), deliver(r.storeId, gw, d)])

    const ok = outcomes.filter((o) => o.ok)
    expect(ok).toHaveLength(2)
    expect(ok.filter((o) => o.ok && o.duplicate)).toHaveLength(1)
    expect(ok.filter((o) => o.ok && o.capturedOrderId === r.orderId)).toHaveLength(1)
    expect(await owner.select().from(paymentEvent)).toHaveLength(1)
    expect((await orderRow(r.orderId))?.paymentStatus).toBe('paid')
  })

  it('a second captured event is a no-op and a late failure does not undo the capture', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    await deliver(r.storeId, gw, {
      eventId: 'e1',
      type: 'payment.captured',
      providerRef: 'order_1',
    })
    const again = await deliver(r.storeId, gw, {
      eventId: 'e2',
      type: 'payment.captured',
      providerRef: 'order_1',
    })
    const late = await deliver(r.storeId, gw, {
      eventId: 'e3',
      type: 'payment.failed',
      providerRef: 'order_1',
    })
    expect(again.ok && again.capturedOrderId).toBeNull()
    expect(late.ok && late.duplicate).toBe(false)
    const [a] = await attemptsOf(r.orderId)
    expect(a).toMatchObject({ status: 'captured', providerPaymentId: 'pay_e1' })
    expect((await orderRow(r.orderId))?.paymentStatus).toBe('paid')
  })

  it('a capture after a failure on the same gateway order still pays the order', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    await deliver(r.storeId, gw, { eventId: 'e1', type: 'payment.failed', providerRef: 'order_1' })
    const out = await deliver(r.storeId, gw, {
      eventId: 'e2',
      type: 'payment.captured',
      providerRef: 'order_1',
    })
    expect(out.ok && out.capturedOrderId).toBe(r.orderId)
    expect((await orderRow(r.orderId))?.paymentStatus).toBe('paid')
  })

  it('a capture after the order was cancelled is flagged refund needed, not revived', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    await withStore(app, r.storeId, (tx) => cancelOrder({ storeId: r.storeId, tx }, r.orderId))

    const out = await deliver(r.storeId, gw, {
      eventId: 'e1',
      type: 'payment.captured',
      providerRef: 'order_1',
    })

    expect(out.ok && out.capturedOrderId).toBeNull()
    expect((await orderRow(r.orderId))?.status).toBe('cancelled')
    const [a] = await attemptsOf(r.orderId)
    expect(a).toMatchObject({ status: 'captured', refundNeeded: true })
  })

  it('a late capture on an old attempt after a newer one paid is flagged, never a second capture', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    await deliver(r.storeId, gw, { eventId: 'e1', type: 'payment.failed', providerRef: 'order_1' })
    await retryAndStartPayment(app, r.storeId, r.orderId, gw)
    await deliver(r.storeId, gw, {
      eventId: 'e2',
      type: 'payment.captured',
      providerRef: 'order_2',
    })
    await deliver(r.storeId, gw, {
      eventId: 'e3',
      type: 'payment.captured',
      providerRef: 'order_1',
    })

    const rows = await attemptsOf(r.orderId)
    expect(rows.map((p) => [p.attempt, p.status, p.refundNeeded])).toEqual([
      [1, 'captured', true],
      [2, 'captured', false],
    ])
  })

  it('finds the attempt by its key when the gateway reference was never recorded', async () => {
    const gw = new GatewayDouble()
    const { storeId, cartId } = await seedCart()
    // Order placed, gateway called, but the process died before recording its answer.
    const r = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: gw }),
    )
    const out = await deliver(storeId, gw, {
      eventId: 'e1',
      type: 'payment.captured',
      providerRef: 'order_lost',
      idempotencyKey: `${r.orderId}:1`,
    })
    expect(out.ok && out.capturedOrderId).toBe(r.orderId)
    const [a] = await attemptsOf(r.orderId)
    expect(a).toMatchObject({ status: 'captured', providerRef: 'order_lost' })
  })

  it("never applies an event to another store's payment", async () => {
    const gw = new GatewayDouble()
    const a = await placed(gw, 'a')
    const b = await placed(gw, 'b')
    // Store A's webhook URL receives an event naming store B's gateway order.
    const out = await deliver(a.storeId, gw, {
      eventId: 'e1',
      type: 'payment.captured',
      providerRef: 'order_2',
      idempotencyKey: `${b.orderId}:1`,
    })
    expect(out.ok && out.applied).toBe(false)
    expect((await orderRow(b.orderId))?.paymentStatus).toBe('unpaid')
    const [pb] = await attemptsOf(b.orderId)
    expect(pb?.status).toBe('pending')
  })

  it('the database allows one gateway capture per order', async () => {
    const gw = new GatewayDouble()
    const r = await placed(gw)
    await deliver(r.storeId, gw, {
      eventId: 'e1',
      type: 'payment.captured',
      providerRef: 'order_1',
    })
    await expect(
      owner.insert(payment).values({
        storeId: r.storeId,
        orderId: r.orderId,
        provider: 'manual',
        providerRef: 'manual_x',
        status: 'captured',
        amountPaise: 1,
      }),
    ).rejects.toThrow()
    // Split tender taken on purpose is allowed.
    await owner.insert(payment).values({
      storeId: r.storeId,
      orderId: r.orderId,
      provider: 'manual',
      providerRef: 'manual_y',
      status: 'captured',
      amountPaise: 1,
      multiCapture: true,
    })
  })
})
