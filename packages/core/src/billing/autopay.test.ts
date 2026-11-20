/** SOURCE OF TRUTH: UPI AutoPay tests — WHAT: starting a plan subscription against a mocked Razorpay (test-mode keys only), its webhooks (activated, charged, halted, cancelled) and the failure paths / WHY: the owner turns AutoPay on from Plan & billing; a charge must bill the plan exactly once and a turned-off mandate must never charge again */
import { createHmac } from 'node:crypto'
import { autopayMandate, createDb, order, payment, planPayment } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedPaidPeriod, seedSalesStore, seedStore } from '../testing/usage-seed'
import {
  type AutopayConfig,
  AutopayError,
  cancelAutopay,
  handleAutopayWebhook,
  loadAutopay,
  startAutopay,
} from './autopay'
import type { BillingEnv } from './service'

const sent = vi.hoisted(() => [] as { kind: string }[])
vi.mock('./emails', async (load) => ({
  ...(await load<typeof import('./emails')>()),
  sendPlanBillEmail: async (_db: unknown, _storeId: string, input: { kind: string }) => {
    sent.push(input)
    return 'sent' as const
  },
}))

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Call = { path: string; body: Record<string, unknown>; auth: string }

/** A Razorpay test-mode double: records each call and answers like the Subscriptions API. */
function razorpay(answer?: (path: string) => Response | Error | undefined) {
  const calls: Call[] = []
  let n = 0
  const fetchFn = async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.razorpay.com/v1', '')
    calls.push({
      path,
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get('authorization') ?? '',
    })
    const custom = answer?.(path)
    if (custom instanceof Error) throw custom
    if (custom) return custom
    n += 1
    if (path === '/plans') return Response.json({ id: `plan_test${n}` })
    if (path === '/subscriptions')
      return Response.json({ id: `sub_test${n}`, short_url: `https://rzp.io/i/test${n}` })
    return Response.json({ id: path.split('/')[2], status: 'cancelled' })
  }
  const cfg: AutopayConfig = {
    keyId: 'rzp_test_dummykey',
    keySecret: 'dummy_test_secret',
    webhookSecret: 'whsec_test_dummy',
    fetch: fetchFn as unknown as typeof fetch,
  }
  return { cfg, calls }
}

function signed(cfg: AutopayConfig, event: string, subId: string, paymentId?: string) {
  const raw = JSON.stringify({
    event,
    payload: {
      subscription: { entity: { id: subId } },
      ...(paymentId ? { payment: { entity: { id: paymentId } } } : {}),
    },
  })
  return { raw, signature: createHmac('sha256', cfg.webhookSecret).update(raw).digest('hex') }
}

const mandates = (storeId: string) =>
  owner.select().from(autopayMandate).where(eq(autopayMandate.storeId, storeId))

async function billingEnv(without: string[] = []): Promise<BillingEnv> {
  return {
    salesStoreId: await seedSalesStore(owner, without),
    settingsSecret: 'test-secret-test-secret-test-secret',
    salesStorefrontUrl: 'https://sales.example.test',
  }
}

describe('starting UPI AutoPay', () => {
  it('creates a GST-inclusive Razorpay plan and subscription and keeps the approve link', async () => {
    const id = await seedStore(owner, 'asha')
    const { cfg, calls } = razorpay()
    const r = await startAutopay(app, id, { plan: 'growth', interval: 'month' }, cfg)
    expect(r.approveUrl).toBe('https://rzp.io/i/test2')
    expect(calls.map((c) => c.path)).toEqual(['/plans', '/subscriptions'])
    expect(calls[0]?.body).toMatchObject({
      period: 'monthly',
      interval: 1,
      item: { amount: Math.round(1_99_900 * 1.18), currency: 'INR' },
    })
    expect(calls[1]?.body).toMatchObject({ plan_id: 'plan_test1', notes: { storeId: id } })
    expect(calls[0]?.auth).toBe(
      `Basic ${Buffer.from('rzp_test_dummykey:dummy_test_secret').toString('base64')}`,
    )
    expect(await loadAutopay(app, id)).toEqual({
      status: 'created',
      plan: 'growth',
      interval: 'month',
      approveUrl: 'https://rzp.io/i/test2',
    })
  })

  it('starting again cancels the unapproved subscription at Razorpay, so its old link cannot charge', async () => {
    const id = await seedStore(owner, 'asha')
    const { cfg, calls } = razorpay()
    await startAutopay(app, id, { plan: 'growth', interval: 'month' }, cfg)
    await startAutopay(app, id, { plan: 'growth', interval: 'month' }, cfg)
    expect(calls.map((c) => c.path)).toContain('/subscriptions/sub_test2/cancel')
    const rows = await mandates(id)
    expect(rows.map((m) => [m.subscriptionId, m.status]).sort()).toEqual([
      ['sub_test2', 'cancelled'],
      ['sub_test4', 'created'],
    ])
  })

  it('refuses a second subscription while one is active, without calling Razorpay', async () => {
    const id = await seedStore(owner, 'asha')
    await owner.insert(autopayMandate).values({
      storeId: id,
      plan: 'growth',
      interval: 'month',
      subscriptionId: 'sub_live',
      status: 'active',
    })
    const { cfg, calls } = razorpay()
    await expect(
      startAutopay(app, id, { plan: 'growth', interval: 'month' }, cfg),
    ).rejects.toBeInstanceOf(AutopayError)
    expect(calls).toEqual([])
  })

  it("shows Razorpay's refusal, or that it could not be reached, and saves no mandate", async () => {
    const id = await seedStore(owner, 'asha')
    const refused = razorpay(() =>
      Response.json({ error: { description: 'Authentication failed' } }, { status: 401 }),
    )
    await expect(
      startAutopay(app, id, { plan: 'growth', interval: 'month' }, refused.cfg),
    ).rejects.toThrow('Authentication failed')
    const down = razorpay(() => new TypeError('fetch failed'))
    await expect(
      startAutopay(app, id, { plan: 'growth', interval: 'month' }, down.cfg),
    ).rejects.toThrow('Could not reach Razorpay')
    // The plan was made but the subscription refused: still nothing to approve.
    const half = razorpay((path) =>
      path === '/subscriptions'
        ? Response.json({ error: { description: 'Plan not found' } }, { status: 400 })
        : undefined,
    )
    await expect(
      startAutopay(app, id, { plan: 'growth', interval: 'month' }, half.cfg),
    ).rejects.toThrow('Plan not found')
    expect(await mandates(id)).toEqual([])
  })
})

describe('AutoPay webhooks', () => {
  async function activeStore(status: 'created' | 'active' = 'created', without: string[] = []) {
    const env = await billingEnv(without)
    const id = await seedStore(owner, 'asha')
    const { cfg, calls } = razorpay()
    await owner.insert(autopayMandate).values({
      storeId: id,
      plan: 'starter',
      interval: 'month',
      subscriptionId: 'sub_w',
      status,
    })
    const send = (event: string, paymentId?: string, now?: Date) => {
      const w = signed(cfg, event, 'sub_w', paymentId)
      return handleAutopayWebhook(app, w.raw, w.signature, cfg, env, now)
    }
    return { env, id, cfg, calls, send }
  }

  it('refuses a bad signature and ignores an unknown subscription', async () => {
    const { id, cfg, env } = await activeStore()
    const w = signed(cfg, 'subscription.activated', 'sub_w')
    expect(await handleAutopayWebhook(app, w.raw, 'deadbeef', cfg, env)).toBe('bad_signature')
    const other = signed(cfg, 'subscription.activated', 'sub_unknown')
    expect(await handleAutopayWebhook(app, other.raw, other.signature, cfg, env)).toBe('ignored')
    expect((await mandates(id))[0]?.status).toBe('created')
  })

  it('activated, then charged: one paid plan bill per Razorpay payment, however often it repeats', async () => {
    const { env, id, send } = await activeStore()
    expect(await send('subscription.activated')).toBe('ok')
    expect((await mandates(id))[0]?.status).toBe('active')

    // Two copies at once and a third later: one bill.
    const results = await Promise.all([
      send('subscription.charged', 'pay_test1'),
      send('subscription.charged', 'pay_test1'),
    ])
    expect(results.sort()).toEqual(['ignored', 'ok'])
    expect(await send('subscription.charged', 'pay_test1')).toBe('ignored')
    const bills = await owner.select().from(planPayment).where(eq(planPayment.storeId, id))
    expect(bills).toHaveLength(1)
    const [captured] = await owner
      .select()
      .from(payment)
      .where(eq(payment.providerPaymentId, 'pay_test1'))
    expect(captured?.status).toBe('captured')
    const [sale] = await owner
      .select()
      .from(order)
      .where(eq(order.id, bills[0]?.salesOrderId as string))
    expect(sale?.storeId).toBe(env.salesStoreId)
    expect(sale?.paymentStatus).toBe('paid')

    // The next month's charge is a new bill; an old payment replayed after it is not.
    expect(await send('subscription.charged', 'pay_test2')).toBe('ok')
    expect(await send('subscription.charged', 'pay_test1')).toBe('ignored')
    expect(await owner.select().from(planPayment).where(eq(planPayment.storeId, id))).toHaveLength(
      2,
    )
    expect(sent).toEqual([])
  })

  it('a first charge with paid time left starts the billed period where that time ends', async () => {
    const { id, send } = await activeStore()
    const now = new Date('2026-11-21T06:00:00Z')
    const ends = new Date('2026-12-05T00:00:00Z')
    await seedPaidPeriod(owner, id, 'starter', new Date('2026-11-05T00:00:00Z'), ends)
    expect(await send('subscription.charged', 'pay_first', now)).toBe('ok')
    const bills = await owner.select().from(planPayment).where(eq(planPayment.status, 'due'))
    expect(bills[0]?.periodStart.toISOString()).toBe(ends.toISOString())
  })

  it('halted emails the owner once; a later charge turns it back on', async () => {
    const { id, send } = await activeStore('active')
    await send('subscription.halted')
    await send('subscription.halted')
    expect(sent.map((s) => s.kind)).toEqual(['autopay_failed'])
    expect((await mandates(id))[0]?.status).toBe('halted')
    expect(await send('subscription.charged', 'pay_retry')).toBe('ok')
    expect((await mandates(id))[0]?.status).toBe('active')
  })

  it('cancelled stays cancelled: a late activated is stopped at Razorpay, never turned back on', async () => {
    const { id, send, calls } = await activeStore('active')
    expect(await send('subscription.cancelled')).toBe('ok')
    expect((await mandates(id))[0]?.status).toBe('cancelled')
    expect(await send('subscription.activated')).toBe('ok')
    expect((await mandates(id))[0]?.status).toBe('cancelled')
    expect(calls.map((c) => c.path)).toEqual(['/subscriptions/sub_w/cancel'])
    // A charge that still came through is billed (the money was taken) and the mandate stays off.
    expect(await send('subscription.charged', 'pay_late')).toBe('ok')
    expect((await mandates(id))[0]?.status).toBe('cancelled')
    expect(await owner.select().from(planPayment).where(eq(planPayment.storeId, id))).toHaveLength(
      1,
    )
  })

  it('a bill that cannot be made gives the charge back to the webhook retry', async () => {
    // No Starter plan SKU on the sales store: the bill is refused.
    const { id, send } = await activeStore('active', ['plan-starter-month'])
    await expect(send('subscription.charged', 'pay_fail')).rejects.toThrow()
    expect((await mandates(id))[0]?.lastPaymentId).toBeNull()
  })
})

describe('turning AutoPay off', () => {
  it('cancels at Razorpay and here, even when Razorpay cannot be reached', async () => {
    const id = await seedStore(owner, 'asha')
    await owner.insert(autopayMandate).values({
      storeId: id,
      plan: 'growth',
      interval: 'month',
      subscriptionId: 'sub_off',
      status: 'active',
    })
    const down = razorpay(() => new TypeError('fetch failed'))
    await cancelAutopay(app, id, down.cfg)
    expect(down.calls.map((c) => c.path)).toEqual(['/subscriptions/sub_off/cancel'])
    expect((await mandates(id))[0]?.status).toBe('cancelled')
    expect(await loadAutopay(app, id)).toBeNull()
  })
})
