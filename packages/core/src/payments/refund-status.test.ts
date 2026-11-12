/** SOURCE OF TRUTH: refund status tests — WHAT: part refunds leave a payment captured, a full one marks it refunded, failed refunds undo it / WHY: #1605 Partly refunded */
import {
  createDb,
  order,
  payment,
  refund,
  store,
  storesWithPendingGatewayRefunds,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { PaymentProvider, WebhookEvent } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { refundPayment } from '../order/refund'
import { syncPendingRefunds } from './refund-sync'
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

/**
 * A gateway stand-in with the given id: refunds are accepted as pending with ids rf_1, rf_2…;
 * webhooks are the JSON of a normalised event; `refundStates` answers `fetchRefundStatus`
 * (only when `asks` is set, like Decentro). No network.
 */
function gateway(id: string, opts: { asks?: boolean } = {}) {
  const refundStates = new Map<string, 'pending' | 'processed' | 'failed'>()
  let n = 0
  const p: PaymentProvider = {
    id,
    label: id,
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
      n += 1
      return { providerRefundId: `rf_${n}`, status: 'pending' as const }
    },
    parseWebhook({ rawBody }) {
      const event = JSON.parse(rawBody) as WebhookEvent
      const key = 'providerRefundId' in event ? event.providerRefundId : 'x'
      return { ok: true, eventId: `${event.type}:${key}`, event }
    },
  }
  if (opts.asks)
    p.fetchRefundStatus = async (i) => refundStates.get(i.providerRefundId) ?? 'pending'
  return { provider: p, refundStates }
}

async function seedPaid(provider: string) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1,
      status: 'open',
      subtotalPaise: 1000,
      totalPaise: 1000,
      paymentMethod: provider,
      paymentStatus: 'paid',
    })
    .returning()
  if (!o) throw new Error('seed')
  const [p] = await owner
    .insert(payment)
    .values({
      storeId: s.id,
      orderId: o.id,
      provider,
      providerRef: 'ref_1',
      providerPaymentId: 'pay_1',
      status: 'captured',
      amountPaise: 1000,
    })
    .returning()
  if (!p) throw new Error('seed')
  return { storeId: s.id, orderId: o.id, paymentId: p.id }
}

async function state(orderId: string, paymentId: string) {
  const [o] = await owner.select().from(order).where(eq(order.id, orderId))
  const [p] = await owner.select().from(payment).where(eq(payment.id, paymentId))
  const refunds = await owner.select().from(refund).where(eq(refund.paymentId, paymentId))
  return {
    order: o?.paymentStatus,
    payment: p?.status,
    refunds: refunds.map((r) => `${r.providerRefundId}:${r.amountPaise}:${r.status}`).sort(),
  }
}

const processed = (providerRefundId: string, amountPaise: number): WebhookEvent => ({
  type: 'refund.processed',
  providerRef: 'ref_1',
  providerRefundId,
  amountPaise,
  orderId: null,
  raw: {},
})
const failed = (providerRefundId: string): WebhookEvent => ({
  type: 'refund.failed',
  providerRef: 'ref_1',
  providerRefundId,
  reason: 'bank refused',
  orderId: null,
  raw: {},
})

describe.each(['razorpay', 'cashfree'])('%s refund webhooks: partly vs fully refunded', (id) => {
  const deliver = (storeId: string, p: PaymentProvider, e: WebhookEvent) =>
    withStore(app, storeId, (tx) =>
      handlePaymentWebhook({ storeId, tx }, p, { rawBody: JSON.stringify(e), headers: {} }),
    )
  const refundOf = (storeId: string, p: PaymentProvider, paymentId: string, amountPaise: number) =>
    withStore(app, storeId, (tx) => refundPayment({ storeId, tx }, p, { paymentId, amountPaise }))

  it('a part refund leaves the payment captured and the order partly refunded', async () => {
    const { storeId, orderId, paymentId } = await seedPaid(id)
    const { provider } = gateway(id)
    await refundOf(storeId, provider, paymentId, 300)
    await deliver(storeId, provider, processed('rf_1', 300))
    expect(await state(orderId, paymentId)).toEqual({
      order: 'partially_refunded',
      payment: 'captured',
      refunds: ['rf_1:300:processed'],
    })
  })

  it('reads "refunded" only once the whole capture went back', async () => {
    const { storeId, orderId, paymentId } = await seedPaid(id)
    const { provider } = gateway(id)
    await refundOf(storeId, provider, paymentId, 300)
    await deliver(storeId, provider, processed('rf_1', 300))
    await refundOf(storeId, provider, paymentId, 700)
    await deliver(storeId, provider, processed('rf_2', 700))
    expect(await state(orderId, paymentId)).toEqual({
      order: 'refunded',
      payment: 'refunded',
      refunds: ['rf_1:300:processed', 'rf_2:700:processed'],
    })
  })

  it('a refund that fails stops counting: the payment goes back to captured', async () => {
    const { storeId, orderId, paymentId } = await seedPaid(id)
    const { provider } = gateway(id)
    await refundOf(storeId, provider, paymentId, 300)
    await refundOf(storeId, provider, paymentId, 700)
    expect((await state(orderId, paymentId)).payment).toBe('refunded')
    await deliver(storeId, provider, failed('rf_2'))
    expect(await state(orderId, paymentId)).toEqual({
      order: 'partially_refunded',
      payment: 'captured',
      refunds: ['rf_1:300:pending', 'rf_2:700:failed'],
    })
  })

  it('a refund made on the gateway dashboard marks the payment refunded only when it is whole', async () => {
    const { storeId, orderId, paymentId } = await seedPaid(id)
    const { provider } = gateway(id)
    const part = await deliver(storeId, provider, processed('rf_dash_1', 400))
    expect(part).toMatchObject({ ok: true, applied: false })
    expect((await state(orderId, paymentId)).payment).toBe('captured')
    await deliver(storeId, provider, processed('rf_dash_2', 1000))
    expect((await state(orderId, paymentId)).payment).toBe('refunded')
  })
})

describe('decentro: refunds settled by the daily status sync', () => {
  const hourAgo = (now: Date) => new Date(now.getTime() - 2 * 3_600_000)

  async function refundsMadeEarlier(storeId: string, p: PaymentProvider, paymentId: string) {
    for (const amountPaise of [300, 700]) {
      await withStore(app, storeId, (tx) =>
        refundPayment({ storeId, tx }, p, { paymentId, amountPaise }),
      )
    }
    // Made two hours ago, past the sync's one-hour wait.
    await owner.update(refund).set({ createdAt: hourAgo(new Date()) })
  }

  it('records processed and failed refunds; a failed one no longer counts as returned', async () => {
    const { storeId, orderId, paymentId } = await seedPaid('decentro')
    const { provider, refundStates } = gateway('decentro', { asks: true })
    await refundsMadeEarlier(storeId, provider, paymentId)
    refundStates.set('rf_1', 'processed')
    refundStates.set('rf_2', 'failed')
    // The worker finds the store through the SECURITY DEFINER lookup (migration 0241).
    expect(await storesWithPendingGatewayRefunds(app)).toEqual([storeId])

    const r = await syncPendingRefunds(app, storeId, [provider])
    expect(r).toEqual({ checked: 2, processed: 1, failed: 1, errors: 0 })
    expect(await state(orderId, paymentId)).toEqual({
      order: 'partially_refunded',
      payment: 'captured',
      refunds: ['rf_1:300:processed', 'rf_2:700:failed'],
    })

    // Settled refunds are not asked about again.
    expect(await syncPendingRefunds(app, storeId, [provider])).toMatchObject({ checked: 0 })
    expect(await storesWithPendingGatewayRefunds(app)).toEqual([])
  })

  it('leaves pending refunds pending, skips new ones, and survives a gateway error', async () => {
    const { storeId, orderId, paymentId } = await seedPaid('decentro')
    const { provider } = gateway('decentro', { asks: true })
    await withStore(app, storeId, (tx) =>
      refundPayment({ storeId, tx }, provider, { paymentId, amountPaise: 300 }),
    )
    // Just made: left for the next run.
    expect(await syncPendingRefunds(app, storeId, [provider])).toMatchObject({ checked: 0 })

    await owner.update(refund).set({ createdAt: hourAgo(new Date()) })
    expect(await syncPendingRefunds(app, storeId, [provider])).toMatchObject({
      checked: 1,
      processed: 0,
      failed: 0,
    })
    provider.fetchRefundStatus = async () => {
      throw new Error('Decentro did not answer in 15s')
    }
    expect(await syncPendingRefunds(app, storeId, [provider])).toMatchObject({
      checked: 1,
      errors: 1,
    })
    expect(await state(orderId, paymentId)).toEqual({
      order: 'partially_refunded',
      payment: 'captured',
      refunds: ['rf_1:300:pending'],
    })
  })

  it('asks nothing of gateways without a refund status lookup', async () => {
    const { storeId, paymentId } = await seedPaid('razorpay')
    const { provider } = gateway('razorpay')
    await withStore(app, storeId, (tx) =>
      refundPayment({ storeId, tx }, provider, { paymentId, amountPaise: 300 }),
    )
    expect(await syncPendingRefunds(app, storeId, [provider])).toMatchObject({ checked: 0 })
  })
})
