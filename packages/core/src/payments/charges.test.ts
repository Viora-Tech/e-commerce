/** SOURCE OF TRUTH: payment charges tests — WHAT: gateway fees recorded from webhooks and the fee sync / WHY: guards the money maths */
import { createDb, order, payment, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { PaymentCharges, PaymentProvider, WebhookEvent } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { merchantFee, syncPaymentFees } from './charges'
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

const DAY = 86_400_000
const NOW = new Date('2026-10-11T12:00:00Z')

/**
 * A gateway double: the webhook body is the normalised event as JSON (signature `good`), and
 * `fetchCharges` answers from a table keyed by gateway payment id, never the network.
 */
function gateway(
  id: string,
  answers: Record<string, PaymentCharges | null | Error> = {},
): PaymentProvider & { asked: string[] } {
  const asked: string[] = []
  return {
    id,
    label: id,
    asked,
    async createPayment() {
      throw new Error('unused')
    },
    async confirm() {
      throw new Error('unused')
    },
    async fetchStatus() {
      throw new Error('unused')
    },
    async refund() {
      throw new Error('unused')
    },
    async fetchCharges({ providerPaymentId }) {
      asked.push(providerPaymentId)
      const a = answers[providerPaymentId]
      if (a instanceof Error) throw a
      return a ?? null
    },
    parseWebhook({ rawBody, headers }) {
      if (headers.sig !== 'good') return { ok: false, reason: 'bad signature' }
      const event = JSON.parse(rawBody) as WebhookEvent
      const ref = 'providerPaymentId' in event ? event.providerPaymentId : 'x'
      return { ok: true, eventId: `${event.type}:${ref}`, event }
    },
  }
}

async function seedStore() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

/** An order with one attempt on `provider`; captured unless a status is given. */
async function seedPayment(
  storeId: string,
  n: number,
  over: Partial<typeof payment.$inferInsert> = {},
) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'open',
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      paymentMethod: 'razorpay',
    })
    .returning()
  if (!o) throw new Error('seed')
  const [p] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId: o.id,
      provider: 'razorpay',
      providerRef: `order_${n}`,
      providerPaymentId: `pay_${n}`,
      status: 'captured',
      amountPaise: 100_000,
      createdAt: new Date(NOW.getTime() - DAY),
      ...over,
    })
    .returning()
  if (!p) throw new Error('seed')
  return p
}

const rowOf = async (id: string) =>
  (await owner.select().from(payment).where(eq(payment.id, id)))[0]

const deliver = (storeId: string, p: PaymentProvider, event: WebhookEvent) =>
  withStore(app, storeId, (tx) =>
    handlePaymentWebhook({ storeId, tx }, p, {
      rawBody: JSON.stringify(event),
      headers: { sig: 'good' },
    }),
  )

describe('merchantFee', () => {
  it('keeps the reported fee and its GST', () => {
    expect(merchantFee({ feePaise: 2_360, feeTaxPaise: 360 }, 100_000)).toEqual({
      feePaise: 2_360,
      feeTaxPaise: 360,
    })
  })

  it('takes off what the shopper paid on top of the attempt, GST in proportion', () => {
    // The shopper paid ₹1,011.80 for a ₹1,000 attempt: ₹11.80 of the ₹23.60 fee was theirs.
    expect(
      merchantFee({ feePaise: 2_360, feeTaxPaise: 360, grossPaise: 101_180 }, 100_000),
    ).toEqual({ feePaise: 1_180, feeTaxPaise: 180 })
    expect(
      merchantFee({ feePaise: 2_360, feeTaxPaise: 360, grossPaise: 102_360 }, 100_000),
    ).toEqual({ feePaise: 0, feeTaxPaise: 0 })
  })

  it('no fee reported is no fee recorded', () => {
    expect(merchantFee({ feePaise: null, feeTaxPaise: null }, 100_000)).toBeNull()
    expect(merchantFee({ feePaise: 500, feeTaxPaise: null }, 100_000)).toEqual({
      feePaise: 500,
      feeTaxPaise: null,
    })
  })
})

describe('fees from webhooks', () => {
  it('a capture that carries the fee and method records both', async () => {
    const storeId = await seedStore()
    const p = await seedPayment(storeId, 1, { status: 'pending', providerPaymentId: null })
    const r = await deliver(storeId, gateway('razorpay'), {
      type: 'payment.captured',
      providerRef: 'order_1',
      providerPaymentId: 'pay_1',
      amountPaise: 100_000,
      orderId: null,
      charges: {
        feePaise: 2_360,
        feeTaxPaise: 360,
        method: { kind: 'card', cardType: 'credit', network: 'visa' },
      },
      raw: {},
    })
    expect(r).toMatchObject({ ok: true, applied: true })
    expect(await rowOf(p.id)).toMatchObject({
      status: 'captured',
      feePaise: 2_360,
      feeTaxPaise: 360,
      methodDetail: { kind: 'card', cardType: 'credit', network: 'visa' },
      // A webhook does not hold the sync back.
      feeCheckedAt: null,
    })
  })

  it('a capture without a fee keeps the method; a later charges event adds the fee', async () => {
    const storeId = await seedStore()
    const p = await seedPayment(storeId, 1, { status: 'pending', providerPaymentId: null })
    const g = gateway('cashfree')
    await deliver(storeId, g, {
      type: 'payment.captured',
      providerRef: 'order_1',
      providerPaymentId: 'pay_1',
      amountPaise: 100_000,
      orderId: null,
      charges: { feePaise: null, feeTaxPaise: null, method: { kind: 'upi' } },
      raw: {},
    })
    expect(await rowOf(p.id)).toMatchObject({ feePaise: null, methodDetail: { kind: 'upi' } })

    const later = await deliver(storeId, g, {
      type: 'payment.charges',
      providerRef: 'order_1',
      providerPaymentId: 'pay_1',
      orderId: null,
      charges: { feePaise: 236, feeTaxPaise: 36, method: null },
      raw: {},
    })
    expect(later).toMatchObject({ ok: true, applied: true })
    expect(await rowOf(p.id)).toMatchObject({
      feePaise: 236,
      feeTaxPaise: 36,
      methodDetail: { kind: 'upi' },
    })
  })

  it('a charges event for an unknown attempt changes nothing', async () => {
    const storeId = await seedStore()
    const p = await seedPayment(storeId, 1)
    const r = await deliver(storeId, gateway('cashfree'), {
      type: 'payment.charges',
      providerRef: 'order_unknown',
      providerPaymentId: 'pay_9',
      orderId: null,
      charges: { feePaise: 236, feeTaxPaise: 36, method: null },
      raw: {},
    })
    expect(r).toMatchObject({ ok: true, applied: false })
    expect((await rowOf(p.id))?.feePaise).toBeNull()
  })
})

describe('syncPaymentFees', () => {
  const noPause = { now: NOW, sleep: async () => undefined }

  it('asks the gateway for each unknown fee, newest first, and records what it says', async () => {
    const storeId = await seedStore()
    const a = await seedPayment(storeId, 1)
    const b = await seedPayment(storeId, 2, { createdAt: new Date(NOW.getTime() - 2 * DAY) })
    const c = await seedPayment(storeId, 3, { createdAt: new Date(NOW.getTime() - 3 * DAY) })
    const g = gateway('razorpay', {
      pay_1: {
        feePaise: 2_360,
        feeTaxPaise: 360,
        method: { kind: 'card', cardType: 'debit', network: 'rupay' },
      },
      pay_2: { feePaise: null, feeTaxPaise: null, method: { kind: 'upi' } },
      pay_3: new Error('Razorpay said 500'),
    })
    const r = await syncPaymentFees(app, storeId, [g], noPause)
    expect(r).toEqual({ checked: 3, recorded: 1, pending: 1, failed: 1 })
    expect(g.asked).toEqual(['pay_1', 'pay_2', 'pay_3'])
    expect(await rowOf(a.id)).toMatchObject({
      feePaise: 2_360,
      feeTaxPaise: 360,
      methodDetail: { kind: 'card', cardType: 'debit', network: 'rupay' },
      feeCheckedAt: NOW,
    })
    expect(await rowOf(b.id)).toMatchObject({ feePaise: null, methodDetail: { kind: 'upi' } })
    expect(await rowOf(c.id)).toMatchObject({ feePaise: null, feeCheckedAt: NOW })
  })

  it('is idempotent: a known fee is never asked again, a recent ask waits six hours', async () => {
    const storeId = await seedStore()
    await seedPayment(storeId, 1)
    await seedPayment(storeId, 2)
    const g = gateway('razorpay', {
      pay_1: { feePaise: 2_360, feeTaxPaise: 360, method: null },
    })
    await syncPaymentFees(app, storeId, [g], noPause)
    expect([...g.asked].sort()).toEqual(['pay_1', 'pay_2'])

    const again = await syncPaymentFees(app, storeId, [g], {
      ...noPause,
      now: new Date(NOW.getTime() + 3_600_000),
    })
    expect(again.checked).toBe(0)

    const later = await syncPaymentFees(app, storeId, [g], {
      ...noPause,
      now: new Date(NOW.getTime() + 7 * 3_600_000),
    })
    expect(later.checked).toBe(1)
    expect(g.asked.at(-1)).toBe('pay_2')
  })

  it('leaves out old, uncaptured and gateway-less payments, and keeps to the limit', async () => {
    const storeId = await seedStore()
    await seedPayment(storeId, 1, { createdAt: new Date(NOW.getTime() - 91 * DAY) })
    await seedPayment(storeId, 2, { status: 'failed' })
    await seedPayment(storeId, 3, { providerPaymentId: null })
    await seedPayment(storeId, 4, { provider: 'decentro' })
    await seedPayment(storeId, 5, { feePaise: 100 })
    await seedPayment(storeId, 6, { status: 'refunded' })
    await seedPayment(storeId, 7)
    // Only Razorpay can be asked here (Decentro reports no fees).
    const g = gateway('razorpay')
    const first = await syncPaymentFees(app, storeId, [g], { ...noPause, limit: 1 })
    expect(first.checked).toBe(1)
    const rest = await syncPaymentFees(app, storeId, [g], noPause)
    expect(rest.checked).toBe(1)
    expect([...g.asked].sort()).toEqual(['pay_6', 'pay_7'])
  })

  it('does nothing when no gateway can be asked', async () => {
    const storeId = await seedStore()
    await seedPayment(storeId, 1)
    const { fetchCharges: _, ...plain } = gateway('razorpay')
    expect(await syncPaymentFees(app, storeId, [plain], noPause)).toEqual({
      checked: 0,
      recorded: 0,
      pending: 0,
      failed: 0,
    })
  })

  it('pauses between gateway calls', async () => {
    const storeId = await seedStore()
    await seedPayment(storeId, 1)
    await seedPayment(storeId, 2)
    const pauses: number[] = []
    await syncPaymentFees(app, storeId, [gateway('razorpay')], {
      now: NOW,
      pauseMs: 300,
      sleep: async (ms) => {
        pauses.push(ms)
      },
    })
    expect(pauses).toEqual([300])
  })
})
