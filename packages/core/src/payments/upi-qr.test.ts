import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  outboxEvent,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentStatus,
  WebhookEvent,
} from '@commerce/payments'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { retryAndStartPayment, syncOpenQrAttempt } from './qr-attempts'
import { handlePaymentWebhook } from './webhook'

/*
 * The auto-confirmed UPI QR flow through the platform: QR created for the
 * exact amount with the attempt's key, the gateway's credit webhook marks the
 * order paid once, and a QR that closes (by webhook or by the clock) gives way
 * to a new attempt. The adapter's HTTP side is covered offline in
 * payments-razorpay; here a double stands in for it.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const NOW = new Date('2026-09-24T12:00:00Z')
const QR_MINUTES = 30

type Delivery = {
  eventId: string
  event: 'qr_code.credited' | 'qr_code.closed'
  qrId: string
  idempotencyKey?: string
}

/** Razorpay-QR-shaped provider without the network. */
class QrDouble implements PaymentProvider {
  readonly id = 'razorpay_upi'
  readonly label = 'UPI (auto-confirmed)'
  readonly webhookId = 'razorpay'
  readonly created: CreatePaymentInput[] = []
  readonly status = new Map<string, PaymentStatus>()

  async createPayment(input: CreatePaymentInput) {
    this.created.push(input)
    const qrId = `qr_${this.created.length}`
    return {
      providerRef: qrId,
      status: 'pending' as const,
      session: {
        kind: 'upi_qr' as const,
        provider: this.id,
        providerRef: qrId,
        qr: {
          imageUrl: `https://rzp.io/i/${qrId}`,
          amountPaise: input.amountPaise,
          expiresAt: new Date(NOW.getTime() + QR_MINUTES * 60_000).toISOString(),
        },
      },
    }
  }
  async confirm() {
    return { status: 'pending' as const, providerPaymentId: null }
  }
  async fetchStatus(ref: string) {
    return { status: this.status.get(ref) ?? 'pending', providerPaymentId: null, amountPaise: 0 }
  }
  async refund() {
    return { providerRefundId: 'rf', status: 'processed' as const }
  }
  parseWebhook({
    rawBody,
    headers,
  }: {
    rawBody: string
    headers: Record<string, string | undefined>
  }) {
    if (headers.sig !== 'ok') return { ok: false as const, reason: 'bad signature' }
    const d = JSON.parse(rawBody) as Delivery
    const event: WebhookEvent =
      d.event === 'qr_code.credited'
        ? {
            type: 'payment.captured',
            providerRef: d.qrId,
            idempotencyKey: d.idempotencyKey ?? null,
            providerPaymentId: `pay_${d.eventId}`,
            amountPaise: 10000,
            orderId: null,
            raw: d,
          }
        : {
            type: 'payment.failed',
            providerRef: d.qrId,
            idempotencyKey: d.idempotencyKey ?? null,
            providerPaymentId: null,
            reason: 'UPI QR closed unpaid (expired)',
            orderId: null,
            raw: d,
          }
    return { ok: true as const, eventId: d.eventId, event }
  }
}

async function seedStore(slug: string) {
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
  return { storeId: s.id, variantId: v.id }
}

async function placeQrOrder(shop: { storeId: string; variantId: string }, qr: QrDouble) {
  const [c] = await owner.insert(cart).values({ storeId: shop.storeId }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: shop.storeId,
    cartId: c.id,
    variantId: shop.variantId,
    quantity: 1,
    unitPricePaise: 10000,
  })
  return placeOrderAndPay(app, shop.storeId, { cartId: c.id, paymentProvider: qr })
}

const deliver = (storeId: string, qr: QrDouble, d: Delivery) =>
  withStore(app, storeId, (tx) =>
    handlePaymentWebhook({ storeId, tx }, qr, {
      rawBody: JSON.stringify(d),
      headers: { sig: 'ok' },
    }),
  )

const attempts = (orderId: string) =>
  owner.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(asc(payment.attempt))

/** An open order reads by its payment status; a closed one by its lifecycle. */
const orderStatus = async (orderId: string) => {
  const [o] = await owner
    .select({ status: order.status, paymentStatus: order.paymentStatus })
    .from(order)
    .where(eq(order.id, orderId))
  return o?.status === 'open' ? o.paymentStatus : o?.status
}

const paidEvents = (orderId: string) =>
  owner
    .select()
    .from(outboxEvent)
    .where(eq(outboxEvent.type, 'order.paid'))
    .then((rows) => rows.filter((r) => (r.payload as { orderId: string }).orderId === orderId))

describe('auto-confirmed UPI QR', () => {
  it('creates one QR for the exact amount, keyed by the attempt', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)
    expect(qr.created).toHaveLength(1)
    expect(qr.created[0]).toMatchObject({
      orderId: r.orderId,
      amountPaise: 10000,
      idempotencyKey: `${r.orderId}:1`,
    })
    const [a] = await attempts(r.orderId)
    expect(a).toMatchObject({ status: 'pending', providerRef: 'qr_1', provider: 'razorpay_upi' })
    expect(a?.checkoutSession).toMatchObject({ kind: 'upi_qr', qr: { amountPaise: 10000 } })
  })

  it('marks the order paid once on the credit webhook; repeats and the twin event change nothing', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)
    const first = await deliver(shop.storeId, qr, {
      eventId: 'evt_1',
      event: 'qr_code.credited',
      qrId: 'qr_1',
    })
    expect(first).toMatchObject({ ok: true, applied: true, duplicate: false })
    expect(await orderStatus(r.orderId)).toBe('paid')

    const again = await deliver(shop.storeId, qr, {
      eventId: 'evt_1',
      event: 'qr_code.credited',
      qrId: 'qr_1',
    })
    expect(again).toMatchObject({ ok: true, duplicate: true, applied: false })
    // Razorpay also sends payment.captured for the same money under its own event id.
    const twin = await deliver(shop.storeId, qr, {
      eventId: 'evt_2',
      event: 'qr_code.credited',
      qrId: 'qr_1',
    })
    expect(twin).toMatchObject({ ok: true, duplicate: false, capturedOrderId: null })
    expect(await paidEvents(r.orderId)).toHaveLength(1)
    expect((await attempts(r.orderId)).map((a) => a.status)).toEqual(['captured'])
  })

  it('finds the attempt by the key in the QR notes when the QR id was never recorded', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)
    await owner.update(payment).set({ providerRef: 'lost' }).where(eq(payment.orderId, r.orderId))
    await deliver(shop.storeId, qr, {
      eventId: 'evt_k',
      event: 'qr_code.credited',
      qrId: 'qr_unknown',
      idempotencyKey: `${r.orderId}:1`,
    })
    expect(await orderStatus(r.orderId)).toBe('paid')
  })

  it('a QR closed unpaid fails the attempt, and a new QR is a new attempt that can be paid', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)
    await deliver(shop.storeId, qr, { eventId: 'evt_c', event: 'qr_code.closed', qrId: 'qr_1' })
    expect((await attempts(r.orderId))[0]?.status).toBe('failed')
    expect(await orderStatus(r.orderId)).toBe('unpaid')

    const next = await retryAndStartPayment(app, shop.storeId, r.orderId, qr, NOW)
    expect(next.session).toMatchObject({ kind: 'upi_qr', providerRef: 'qr_2' })
    expect(qr.created[1]).toMatchObject({ amountPaise: 10000, idempotencyKey: `${r.orderId}:2` })
    await deliver(shop.storeId, qr, { eventId: 'evt_p', event: 'qr_code.credited', qrId: 'qr_2' })
    expect(await orderStatus(r.orderId)).toBe('paid')
    expect((await attempts(r.orderId)).map((a) => a.status)).toEqual(['failed', 'captured'])
  })

  it('a QR past its close time with no webhook yet is checked with the gateway, then replaced', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)
    const later = new Date(NOW.getTime() + (QR_MINUTES + 1) * 60_000)

    // Still open by the clock: "new QR" hands the same attempt back.
    const same = await retryAndStartPayment(app, shop.storeId, r.orderId, qr, NOW)
    expect(same.session).toMatchObject({ providerRef: 'qr_1' })
    expect(qr.created).toHaveLength(1)

    qr.status.set('qr_1', 'failed')
    const fresh = await retryAndStartPayment(app, shop.storeId, r.orderId, qr, later)
    expect(fresh.session).toMatchObject({ kind: 'upi_qr', providerRef: 'qr_2' })
    expect((await attempts(r.orderId)).map((a) => a.status)).toEqual(['failed', 'pending'])
  })

  it('a QR paid just before it closed is recorded as paid instead of replaced', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)
    qr.status.set('qr_1', 'captured')
    const later = new Date(NOW.getTime() + (QR_MINUTES + 1) * 60_000)
    const out = await retryAndStartPayment(app, shop.storeId, r.orderId, qr, later)
    expect(out).toMatchObject({ status: 'captured', becameCaptured: true })
    expect(qr.created).toHaveLength(1)
    expect(await orderStatus(r.orderId)).toBe('paid')
  })

  it('an open QR paid without a webhook turns paid when the shopper page checks', async () => {
    const shop = await seedStore('a')
    const qr = new QrDouble()
    const r = await placeQrOrder(shop, qr)

    // Not paid yet: nothing changes and the QR stays open.
    expect(await syncOpenQrAttempt(app, shop.storeId, r.orderId, qr)).toBeNull()
    expect((await attempts(r.orderId)).map((a) => a.status)).toEqual(['pending'])

    qr.status.set('qr_1', 'captured')
    const out = await syncOpenQrAttempt(app, shop.storeId, r.orderId, qr)
    expect(out).toMatchObject({ becameCaptured: true })
    expect(await orderStatus(r.orderId)).toBe('paid')
    expect(await paidEvents(r.orderId)).toHaveLength(1)

    // A second check after the capture is a no-op.
    expect(await syncOpenQrAttempt(app, shop.storeId, r.orderId, qr)).toBeNull()
  })

  it("never applies one store's QR webhook to another store's order", async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const qr = new QrDouble()
    const orderA = await placeQrOrder(a, qr)
    const out = await deliver(b.storeId, qr, {
      eventId: 'evt_x',
      event: 'qr_code.credited',
      qrId: 'qr_1',
      idempotencyKey: `${orderA.orderId}:1`,
    })
    expect(out).toMatchObject({ ok: true, applied: false })
    expect(await orderStatus(orderA.orderId)).toBe('unpaid')
  })
})
