import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  orderNote,
  outboxEvent,
  payment,
  product,
  refund,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deliverNotification } from '../notifications/deliver'
import { builtInNotificationRegistry } from '../notifications/settings'
import { fulfilOrderLines } from '../order/fulfil'
import { placeOrderAndPay } from '../order/place-order'
import { GatewayDouble } from '../payments/gateway-double.test-util'
import { handlePaymentWebhook } from '../payments/webhook'
import { FakePaymentProvider } from '../providers/payment'
import {
  BalanceNotPayable,
  balanceProvider,
  openBalanceAttempt,
  recordBalancePaid,
  requestBalance,
  startBalancePayment,
} from './balance'
import { runBalanceSchedule } from './balance-schedule'
import type { PreorderStoreSettings } from './store-settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const DAY = 86_400_000
const SECRET = 'test-settings-secret'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore(policy: Partial<PreorderStoreSettings> = {}) {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, preorder: { unpaidAction: 'none', ...policy } })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

/**
 * A placed and deposit-paid pre-order: ₹1,000 item, ₹200 deposit per unit,
 * two units, so ₹400 paid now and ₹1,600 owed. 1 in stock, 1 pre-ordered.
 */
async function seedDepositOrder(storeId: string, opts: { shipDate?: Date } = {}) {
  const [p] = await owner
    .insert(product)
    .values({
      storeId,
      handle: `pre-${Math.random().toString(36).slice(2)}`,
      title: 'Gadget',
      status: 'active',
      preorderEnabled: true,
      preorderPaymentMode: 'fixed',
      preorderDepositPaise: 20_000,
      preorderShipDate: opts.shipDate ?? null,
    })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p.id, title: 'Default', pricePaise: 100_000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId, variantId: v.id, onHand: 1 })
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId,
    cartId: c.id,
    variantId: v.id,
    quantity: 2,
    unitPricePaise: 100_000,
    preorder: true,
  })
  const deposit = new FakePaymentProvider({ mode: 'capture' })
  const placed = await placeOrderAndPay(app, storeId, { cartId: c.id, paymentProvider: deposit })
  return { orderId: placed.orderId, variantId: v.id, deposit }
}

const orderRow = async (id: string) => (await owner.select().from(order).where(eq(order.id, id)))[0]

const outboxOf = (storeId: string, type: string) =>
  owner
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.storeId, storeId), eq(outboxEvent.type, type)))

const reservedOf = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.reserved

describe('balance attempt', () => {
  it('captures the balance, unblocks fulfilment and announces it once', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    const before = await orderRow(orderId)
    expect(before?.status).toBe('paid')
    expect(before?.balanceDuePaise).toBe(160_000)

    const gw = new FakePaymentProvider({ mode: 'capture', id: 'fake' })
    const started = await startBalancePayment(app, storeId, orderId, gw)
    expect(started.status).toBe('captured')
    expect(started.becameCaptured).toBe(true)
    expect(gw.calls).toEqual([`createPayment:${orderId}:160000`])

    const after = await orderRow(orderId)
    expect(after?.balancePaidAt).not.toBeNull()
    expect(after?.balanceDuePaise).toBe(0)
    expect(after?.status).toBe('paid')
    expect(await outboxOf(storeId, 'order.balance_paid')).toHaveLength(1)
    // Only the deposit moved the order to paid; the balance does not announce it again.
    expect(await outboxOf(storeId, 'order.paid')).toHaveLength(1)

    const pays = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    const bal = pays.find((p) => p.purpose === 'balance')
    expect(bal?.amountPaise).toBe(160_000)
    expect(bal?.refundNeeded).toBe(false)

    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, orderId))
    const packed = await withStore(app, storeId, (tx) =>
      fulfilOrderLines(
        { storeId, tx },
        { orderId, lines: lines.map((l) => ({ lineId: l.id, quantity: l.quantity })) },
      ),
    )
    expect(packed.complete).toBe(true)
  })

  it('duplicate and out-of-order webhooks settle the balance exactly once', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    const gw = new GatewayDouble()
    const started = await startBalancePayment(app, storeId, orderId, gw)
    expect(started.status).toBe('pending')
    const [bal] = await owner.select().from(payment).where(eq(payment.id, started.attemptId))
    const body = (eventId: string) =>
      JSON.stringify({
        eventId,
        type: 'payment.captured',
        providerRef: bal?.providerRef,
        idempotencyKey: bal?.idempotencyKey,
      })
    const deliver = (eventId: string) =>
      withStore(app, storeId, (tx) =>
        handlePaymentWebhook({ storeId, tx }, gw, {
          rawBody: body(eventId),
          headers: { sig: 'ok' },
        }),
      )
    const first = await deliver('evt_1')
    const again = await deliver('evt_1')
    const other = await deliver('evt_2')
    expect(first.ok && first.capturedOrderId).toBe(orderId)
    expect(again.ok && again.duplicate).toBe(true)
    expect(other.ok && other.capturedOrderId).toBeNull()

    expect(await outboxOf(storeId, 'order.balance_paid')).toHaveLength(1)
    const [p] = await owner.select().from(payment).where(eq(payment.id, started.attemptId))
    expect(p?.status).toBe('captured')
    expect(p?.refundNeeded).toBe(false)
  })

  it('keeps one open balance attempt, and the gateway is asked once', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    const gw = new GatewayDouble()
    const [a, b] = await Promise.all([
      startBalancePayment(app, storeId, orderId, gw),
      startBalancePayment(app, storeId, orderId, gw),
    ])
    const c = await startBalancePayment(app, storeId, orderId, gw)
    expect(new Set([a.attemptId, b.attemptId, c.attemptId]).size).toBe(1)
    expect(gw.created).toHaveLength(1)
    const rows = await owner
      .select()
      .from(payment)
      .where(and(eq(payment.orderId, orderId), eq(payment.purpose, 'balance')))
    expect(rows).toHaveLength(1)
  })

  it('a failed balance attempt is replaced by a new one', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    const gw = new GatewayDouble()
    gw.failNext = true
    const failed = await startBalancePayment(app, storeId, orderId, gw)
    expect(failed.status).toBe('failed')
    const next = await startBalancePayment(app, storeId, orderId, gw)
    expect(next.attemptId).not.toBe(failed.attemptId)
    expect(next.status).toBe('pending')
  })

  it('a second capture after the balance is paid is flagged for refund, not applied', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    await withStore(app, storeId, (tx) => recordBalancePaid({ storeId, tx }, orderId))
    await expect(
      startBalancePayment(app, storeId, orderId, new FakePaymentProvider()),
    ).rejects.toThrow(BalanceNotPayable)
    expect(await outboxOf(storeId, 'order.balance_paid')).toHaveLength(1)
    const [paidByHand] = await owner
      .select()
      .from(payment)
      .where(and(eq(payment.orderId, orderId), eq(payment.purpose, 'balance')))
    expect(paidByHand?.provider).toBe('manual')
    expect(paidByHand?.status).toBe('captured')
  })

  it('refuses a balance on an order with no deposit, or before the deposit is paid', async () => {
    const storeId = await seedStore()
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 99, subtotalPaise: 1000, totalPaise: 1000, status: 'paid' })
      .returning()
    await expect(
      withStore(app, storeId, (tx) => openBalanceAttempt({ storeId, tx }, o?.id as string, 'fake')),
    ).rejects.toThrow(/none due/)
    await owner
      .update(order)
      .set({ status: 'placed', balanceDuePaise: 500, depositPaise: 500 })
      .where(eq(order.id, o?.id as string))
    await expect(
      withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, o?.id as string)),
    ).rejects.toThrow(/deposit not paid/)
  })

  it('picks the deposit gateway, never COD', () => {
    const cod = new FakePaymentProvider({ mode: 'capture', id: 'cod' })
    const rzp = new FakePaymentProvider({ mode: 'capture', id: 'razorpay' })
    const other = new FakePaymentProvider({ mode: 'capture', id: 'other' })
    expect(balanceProvider([cod, other, rzp], 'razorpay')?.id).toBe('razorpay')
    expect(balanceProvider([cod, other], 'razorpay')?.id).toBe('other')
    expect(balanceProvider([cod], 'cod')).toBeNull()
  })
})

describe('balance request and reminders', () => {
  it('request keeps the first date and can be sent again', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    const t0 = new Date('2026-10-01T06:00:00Z')
    const first = await withStore(app, storeId, (tx) =>
      requestBalance({ storeId, tx }, orderId, { now: t0, author: 'kd@example.com' }),
    )
    const again = await withStore(app, storeId, (tx) =>
      requestBalance({ storeId, tx }, orderId, { now: new Date(t0.getTime() + DAY) }),
    )
    expect(first.firstRequest).toBe(true)
    expect(again.firstRequest).toBe(false)
    expect((await orderRow(orderId))?.balanceRequestedAt).toEqual(t0)
    const events = await outboxOf(storeId, 'order.balance_requested')
    expect(events).toHaveLength(2)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.author)).toContain('kd@example.com')
  })

  it('sends at most two reminders, on the configured days', async () => {
    const storeId = await seedStore({ reminderDays: [3, 6] })
    const { orderId, deposit } = await seedDepositOrder(storeId)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    const at = (days: number) => new Date(t0.getTime() + days * DAY + 1000)
    const run = (days: number) => runBalanceSchedule(app, storeId, [deposit], at(days))

    expect(await run(1)).toEqual([])
    expect((await run(3)).map((r) => r.result)).toEqual(['reminded'])
    expect(await run(4)).toEqual([])
    expect((await run(6)).map((r) => r.result)).toEqual(['reminded'])
    expect(await run(30)).toEqual([])
    expect(await outboxOf(storeId, 'order.balance_reminder')).toHaveLength(2)
    expect((await orderRow(orderId))?.balanceRemindersSent).toBe(2)
  })

  it('stops reminding once the balance is paid', async () => {
    const storeId = await seedStore({ reminderDays: [3, 6] })
    const { orderId, deposit } = await seedDepositOrder(storeId)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    await startBalancePayment(app, storeId, orderId, new FakePaymentProvider())
    const out = await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 7 * DAY))
    expect(out).toEqual([])
    expect(await outboxOf(storeId, 'order.balance_reminder')).toHaveLength(0)
  })

  it('stops reminding once the order is cancelled', async () => {
    const storeId = await seedStore({ reminderDays: [3] })
    const { orderId, deposit } = await seedDepositOrder(storeId)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, orderId))
    expect(
      await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 4 * DAY)),
    ).toEqual([])
  })

  it('requests the balance automatically ahead of the ship date', async () => {
    const now = new Date()
    const storeId = await seedStore({ autoRequestDaysBeforeShip: 2 })
    const { orderId, deposit } = await seedDepositOrder(storeId, {
      shipDate: new Date(now.getTime() + 5 * DAY),
    })
    expect(await runBalanceSchedule(app, storeId, [deposit], now)).toEqual([])
    const later = new Date(now.getTime() + 3 * DAY + 1000)
    const out = await runBalanceSchedule(app, storeId, [deposit], later)
    expect(out.map((r) => r.result)).toEqual(['requested'])
    expect((await orderRow(orderId))?.balanceRequestedAt).toEqual(later)
    expect(await outboxOf(storeId, 'order.balance_requested')).toHaveLength(1)
  })

  it('the request email carries a signed pay link, and is skipped once paid', async () => {
    const storeId = await seedStore()
    const { orderId } = await seedDepositOrder(storeId)
    await owner.update(order).set({ email: 'asha@example.com' }).where(eq(order.id, orderId))
    const sent: Message[] = []
    const email: NotificationChannel = {
      id: 'email',
      label: 'Email',
      requires: 'email',
      async send(m) {
        sent.push(m)
        return { ok: true, providerRef: `m${sent.length}` }
      },
    }
    const opts = {
      registry: builtInNotificationRegistry(),
      settingsSecret: SECRET,
      storefrontUrl: 'https://shop.test',
      channels: [email],
      resend: true,
    }
    await withStore(app, storeId, (tx) =>
      deliverNotification({ storeId, tx }, { orderId, template: 'balance_request' }, opts),
    )
    expect(sent[0]?.data.actionUrl).toMatch(/^https:\/\/shop\.test\/checkout\/balance\//)
    expect(sent[0]?.data.balance?.dueLabel).toContain('1,600')
    await withStore(app, storeId, (tx) => recordBalancePaid({ storeId, tx }, orderId))
    const after = await withStore(app, storeId, (tx) =>
      deliverNotification({ storeId, tx }, { orderId, template: 'balance_reminder' }, opts),
    )
    expect(after).toEqual([])
    expect(sent).toHaveLength(1)
  })
})

describe('unpaid balance rule', () => {
  it('cancel and refund: deposit refunded through the refund path, stock released', async () => {
    const storeId = await seedStore({
      unpaidAction: 'cancel_refund',
      payWithinDays: 5,
      reminderDays: [],
    })
    const { orderId, variantId, deposit } = await seedDepositOrder(storeId)
    expect(await reservedOf(variantId)).toBe(2)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    expect(
      await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 4 * DAY)),
    ).toEqual([])
    const out = await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 5 * DAY))
    expect(out.map((r) => r.result)).toEqual(['cancelled'])

    expect((await orderRow(orderId))?.status).toBe('cancelled')
    expect(await reservedOf(variantId)).toBe(0)
    const refunds = await owner.select().from(refund).where(eq(refund.orderId, orderId))
    expect(refunds.map((r) => r.amountPaise)).toEqual([40_000])
    expect(deposit.calls.filter((c) => c.startsWith('refund:'))).toHaveLength(1)
    const events = await outboxOf(storeId, 'refund.created')
    expect(events.map((e) => (e.payload as { refundId: string }).refundId)).toEqual([
      refunds[0]?.id,
    ])
    // A second run finds nothing to do: no second refund.
    expect(
      await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 9 * DAY)),
    ).toEqual([])
    expect(await owner.select().from(refund).where(eq(refund.orderId, orderId))).toHaveLength(1)
  })

  it('cancel and keep: no refund, stock released, the deposit stays', async () => {
    const storeId = await seedStore({ unpaidAction: 'cancel_keep', payWithinDays: 5 })
    const { orderId, variantId, deposit } = await seedDepositOrder(storeId)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    const out = await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 6 * DAY))
    expect(out.map((r) => r.result)).toEqual(['cancelled'])
    expect((await orderRow(orderId))?.status).toBe('cancelled')
    expect(await reservedOf(variantId)).toBe(0)
    expect(await owner.select().from(refund).where(eq(refund.orderId, orderId))).toHaveLength(0)
    expect(await outboxOf(storeId, 'refund.created')).toHaveLength(0)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.some((n) => n.body.includes('Deposit kept'))).toBe(true)
  })

  it('a balance the gateway already captured settles the order instead of cancelling', async () => {
    const storeId = await seedStore({ unpaidAction: 'cancel_refund', payWithinDays: 5 })
    const { orderId, deposit } = await seedDepositOrder(storeId)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    const gw = new GatewayDouble()
    const started = await startBalancePayment(app, storeId, orderId, gw)
    const [bal] = await owner.select().from(payment).where(eq(payment.id, started.attemptId))
    gw.status.set(bal?.providerRef as string, 'captured')
    const out = await runBalanceSchedule(
      app,
      storeId,
      [deposit, gw],
      new Date(t0.getTime() + 6 * DAY),
    )
    expect(out.map((r) => r.result)).toEqual(['paid'])
    expect((await orderRow(orderId))?.status).toBe('paid')
    expect((await orderRow(orderId))?.balancePaidAt).not.toBeNull()
  })

  it('never cancels while the rule is off', async () => {
    const storeId = await seedStore({ unpaidAction: 'none', reminderDays: [] })
    const { orderId, deposit } = await seedDepositOrder(storeId)
    const t0 = new Date()
    await withStore(app, storeId, (tx) => requestBalance({ storeId, tx }, orderId, { now: t0 }))
    expect(
      await runBalanceSchedule(app, storeId, [deposit], new Date(t0.getTime() + 60 * DAY)),
    ).toEqual([])
    expect((await orderRow(orderId))?.status).toBe('paid')
  })
})

describe('store isolation', () => {
  it("one store's job and pay button never reach another store's order", async () => {
    const storeA = await seedStore({ unpaidAction: 'cancel_refund', payWithinDays: 1 })
    const storeB = await seedStore({ unpaidAction: 'cancel_refund', payWithinDays: 1 })
    const a = await seedDepositOrder(storeA)
    const t0 = new Date()
    await withStore(app, storeA, (tx) =>
      requestBalance({ storeId: storeA, tx }, a.orderId, { now: t0 }),
    )

    expect(
      await runBalanceSchedule(app, storeB, [a.deposit], new Date(t0.getTime() + 2 * DAY)),
    ).toEqual([])
    expect((await orderRow(a.orderId))?.status).toBe('paid')
    await expect(
      startBalancePayment(app, storeB, a.orderId, new FakePaymentProvider()),
    ).rejects.toThrow(/not found/)
    await expect(
      withStore(app, storeB, (tx) => requestBalance({ storeId: storeB, tx }, a.orderId)),
    ).rejects.toThrow(BalanceNotPayable)
    expect(await outboxOf(storeB, 'order.balance_requested')).toHaveLength(0)
  })
})
