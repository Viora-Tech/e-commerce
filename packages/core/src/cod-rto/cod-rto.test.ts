/** SOURCE OF TRUTH: COD & RTO app tests (database) — history gathering for the score, the checkout COD rule, saving a score on an order, the confirm / cancel link, the deadline sweep, the message's channel, and the reports */
import {
  address,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  orderNote,
  outboxEvent,
  product,
  returnRequest,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { CheckoutRuleViolation } from '../errors'
import { signOrderToken } from '../preorder/balance-link'
import {
  answerCodConfirmation,
  codConfirmDelivery,
  codConfirmView,
  markCodConfirmed,
  requestCodConfirmation,
  runCodConfirmationSweep,
} from './confirm'
import { codRtoOverview, listRiskOrders, orderCodRto } from './overview'
import { assessCheckoutRisk, rescoreOrder, saveCodRtoSettings } from './risk'
import { COD_RTO_APP_ID, COD_RTO_TAGS } from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'
const HOUR = 3_600_000
const PIN = '560001'
const PHONE = '9876543210'

const codConfirmToken = (orderId: string, secret: string) =>
  signOrderToken('cod-confirm', orderId, secret, 86_400_000)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

let n = 0

async function seedStore(installed = true) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: `c-${Math.random().toString(36).slice(2)}`,
      name: 'Waimers',
      apps: { installed: installed ? [COD_RTO_APP_ID] : [] },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Large', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  return { storeId: s.id, variantId: v.id }
}

/** An order to PIN with one line; optionally a finished shipment and an RTO task. */
async function seedOrder(
  s: { storeId: string; variantId: string },
  opts: {
    phone?: string
    pincode?: string
    line1?: string
    paymentMethod?: string
    shipped?: 'delivered' | 'rto'
    status?: 'open' | 'cancelled' | 'completed'
    verification?: 'pending' | 'unconfirmed'
    requestedAt?: Date
  } = {},
) {
  n += 1
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.storeId,
      name: 'Asha',
      line1: opts.line1 ?? 'Flat 12, Shanti Apartments',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: opts.pincode ?? PIN,
      phone: opts.phone ?? PHONE,
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.storeId,
      number: n,
      status: opts.status ?? 'open',
      subtotalPaise: 100000,
      totalPaise: 100000,
      paymentMethod: opts.paymentMethod ?? 'cod',
      phone: opts.phone ?? PHONE,
      email: `${opts.phone ?? PHONE}@example.com`,
      shippingAddressId: a?.id,
      codVerification: opts.verification ?? null,
      codVerifyRequestedAt: opts.verification ? (opts.requestedAt ?? new Date()) : null,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId: s.storeId,
    orderId: o.id,
    variantId: s.variantId,
    title: 'Pad',
    variantTitle: 'Large',
    quantity: 1,
    unitPricePaise: 100000,
  })
  if (opts.shipped) {
    const [sh] = await owner
      .insert(shipment)
      .values({
        storeId: s.storeId,
        orderId: o.id,
        provider: 'fake',
        waybill: `W${n}`,
        status: opts.shipped,
      })
      .returning()
    if (opts.shipped === 'rto') {
      await owner.insert(returnRequest).values({
        storeId: s.storeId,
        orderId: o.id,
        number: n,
        kind: 'rto',
        status: 'received',
        shipmentId: sh?.id,
        requestedBy: 'system',
      })
    }
  }
  return o
}

const facts = {
  pincode: PIN,
  phone: PHONE,
  email: `${PHONE}@example.com`,
  line1: 'Flat 12, Shanti Apartments',
  orderValuePaise: 100000,
  paymentMethod: 'cod',
}

describe('RTO risk from the store’s history', () => {
  it('reads the PIN code’s RTO rate and the shopper’s past RTO', async () => {
    const s = await seedStore()
    await seedOrder(s, { shipped: 'rto' })
    await seedOrder(s, { shipped: 'rto', phone: '9000000001' })
    for (let i = 0; i < 3; i++) await seedOrder(s, { shipped: 'delivered', phone: '9000000002' })
    const risk = await inStore(s.storeId, (ctx) =>
      assessCheckoutRisk(ctx, facts).then((r) => r?.risk),
    )
    expect(risk?.factors.map((f) => f.code)).toEqual(['pincode_rto_high', 'shopper_rto'])
    expect(risk?.score).toBe(65)
    expect(risk?.level).toBe('high')
    // Another PIN, a new shopper: only "first order".
    const fresh = await inStore(s.storeId, (ctx) =>
      assessCheckoutRisk(ctx, {
        ...facts,
        pincode: '110001',
        phone: '9111111111',
        email: 'new@example.com',
      }).then((r) => r?.risk),
    )
    expect(fresh?.factors).toEqual([{ code: 'first_order', points: 10 }])
  })

  it('checkout: nothing without the app, refuses COD for high risk when the store says so', async () => {
    const off = await seedStore(false)
    expect(await inStore(off.storeId, (ctx) => assessCheckoutRisk(ctx, facts))).toBeNull()

    const s = await seedStore()
    await seedOrder(s, { shipped: 'rto' })
    await seedOrder(s, { shipped: 'rto', phone: '9000000001' })
    for (let i = 0; i < 3; i++) await seedOrder(s, { shipped: 'delivered', phone: '9000000002' })
    const allowed = await inStore(s.storeId, (ctx) => assessCheckoutRisk(ctx, facts))
    expect(allowed?.risk.level).toBe('high')
    expect(allowed?.verify).toBe(true)
    await inStore(s.storeId, (ctx) =>
      saveCodRtoSettings(ctx.tx, ctx.storeId, {
        rules: { hideCodForHighRisk: true },
      }),
    )
    await expect(inStore(s.storeId, (ctx) => assessCheckoutRisk(ctx, facts))).rejects.toThrow(
      CheckoutRuleViolation,
    )
    // Paying online is still fine.
    const prepaid = await inStore(s.storeId, (ctx) =>
      assessCheckoutRisk(ctx, { ...facts, paymentMethod: 'razorpay' }),
    )
    expect(prepaid?.verify).toBe(false)
  })

  it('scores an existing order, tags it, and shows it in the lists', async () => {
    const s = await seedStore()
    await seedOrder(s, { shipped: 'rto' })
    await seedOrder(s, { shipped: 'rto', phone: '9000000001' })
    for (let i = 0; i < 3; i++) await seedOrder(s, { shipped: 'delivered', phone: '9000000002' })
    const o = await seedOrder(s, { line1: 'Near temple' })
    const risk = await inStore(s.storeId, (ctx) => rescoreOrder(ctx, o.id))
    expect(risk?.level).toBe('high')
    const [row] = await owner.select().from(order).where(eq(order.id, o.id))
    expect(row?.rtoRisk?.score).toBe(risk?.score)
    expect(row?.tags).toContain(COD_RTO_TAGS.highRisk)

    const list = await inStore(s.storeId, (ctx) =>
      listRiskOrders(ctx, { filter: 'high', openOnly: true, page: 1, perPage: 25 }),
    )
    expect(list.items.map((i) => i.id)).toEqual([o.id])
    expect(list.items[0]?.level).toBe('high')
    const card = await inStore(s.storeId, (ctx) => orderCodRto(ctx, o.id))
    expect(card?.risk?.level).toBe('high')

    const overview = await inStore(s.storeId, (ctx) => codRtoOverview(ctx, 30))
    expect(overview.cod).toMatchObject({ codFinished: 5, codRto: 2, codRate: 40 })
    expect(overview.openByLevel.high).toBe(1)
    expect(overview.pincodes[0]).toMatchObject({ pincode: PIN, rto: 2, shipments: 5 })
  })
})

describe('COD confirmation', () => {
  it('asks, then the shopper confirms once from the link', async () => {
    const s = await seedStore()
    const o = await seedOrder(s)
    await inStore(s.storeId, (ctx) => requestCodConfirmation(ctx, o.id))
    const events = await owner
      .select()
      .from(outboxEvent)
      .where(eq(outboxEvent.type, 'order.cod_confirm_requested'))
    expect(events).toHaveLength(1)

    const token = codConfirmToken(o.id, SECRET)
    const view = await inStore(s.storeId, (ctx) => codConfirmView(ctx, token, SECRET))
    expect(view).toMatchObject({
      orderNumber: o.number,
      items: 1,
      status: 'pending',
      canCancel: true,
    })
    expect(await inStore(s.storeId, (ctx) => codConfirmView(ctx, `${token}x`, SECRET))).toBeNull()

    const r = await inStore(s.storeId, (ctx) =>
      answerCodConfirmation(ctx, token, SECRET, 'confirm'),
    )
    expect(r).toEqual({ ok: true, status: 'confirmed' })
    // A later "cancel" changes nothing.
    const again = await inStore(s.storeId, (ctx) =>
      answerCodConfirmation(ctx, token, SECRET, 'cancel'),
    )
    expect(again).toEqual({ ok: true, status: 'confirmed' })
    const [row] = await owner.select().from(order).where(eq(order.id, o.id))
    expect(row?.status).toBe('open')
    expect(row?.codVerification).toBe('confirmed')
    expect(
      await inStore(s.storeId, (ctx) =>
        answerCodConfirmation(ctx, 'bad.token.x', SECRET, 'confirm'),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
  })

  it('cancelling from the link cancels the order, unless it shipped', async () => {
    const s = await seedStore()
    const o = await seedOrder(s, { verification: 'pending' })
    const token = codConfirmToken(o.id, SECRET)
    expect(
      await inStore(s.storeId, (ctx) => answerCodConfirmation(ctx, token, SECRET, 'cancel')),
    ).toEqual({ ok: true, status: 'cancelled' })
    const [row] = await owner.select().from(order).where(eq(order.id, o.id))
    expect(row?.status).toBe('cancelled')

    const shipped = await seedOrder(s, { verification: 'pending' })
    await owner.update(order).set({ fulfillmentStatus: 'shipped' }).where(eq(order.id, shipped.id))
    expect(
      await inStore(s.storeId, (ctx) =>
        answerCodConfirmation(ctx, codConfirmToken(shipped.id, SECRET), SECRET, 'cancel'),
      ),
    ).toEqual({ ok: false, reason: 'shipped' })
  })

  it('the sweep flags unanswered orders, and cancels them only when opted in', async () => {
    const s = await seedStore()
    const now = new Date()
    const late = await seedOrder(s, {
      verification: 'pending',
      requestedAt: new Date(now.getTime() - 30 * HOUR),
    })
    const recent = await seedOrder(s, { verification: 'pending', requestedAt: now })
    const flagged = await runCodConfirmationSweep(app, s.storeId, now)
    expect(flagged).toEqual({ flagged: 1, cancelled: 0 })
    const [row] = await owner.select().from(order).where(eq(order.id, late.id))
    expect(row?.codVerification).toBe('unconfirmed')
    expect(row?.tags).toContain(COD_RTO_TAGS.unconfirmed)
    const [fresh] = await owner.select().from(order).where(eq(order.id, recent.id))
    expect(fresh?.codVerification).toBe('pending')
    expect(await owner.select().from(orderNote).where(eq(orderNote.orderId, late.id))).toHaveLength(
      1,
    )
    // Flagged once only.
    expect(await runCodConfirmationSweep(app, s.storeId, now)).toEqual({ flagged: 0, cancelled: 0 })

    await inStore(s.storeId, (ctx) =>
      saveCodRtoSettings(ctx.tx, ctx.storeId, { verification: { autoCancel: true } }),
    )
    const later = new Date(now.getTime() + 20 * HOUR)
    expect(await runCodConfirmationSweep(app, s.storeId, later)).toEqual({
      flagged: 0,
      cancelled: 1,
    })
    const [gone] = await owner.select().from(order).where(eq(order.id, late.id))
    expect(gone?.status).toBe('cancelled')
  })

  it('the merchant marks a COD order confirmed by phone', async () => {
    const s = await seedStore()
    const o = await seedOrder(s, { verification: 'unconfirmed' })
    await owner
      .update(order)
      .set({ tags: [COD_RTO_TAGS.unconfirmed] })
      .where(eq(order.id, o.id))
    await inStore(s.storeId, (ctx) => markCodConfirmed(ctx, o.id, 'owner@example.com'))
    const [row] = await owner.select().from(order).where(eq(order.id, o.id))
    expect(row?.codVerification).toBe('confirmed')
    expect(row?.tags).toEqual([])
  })

  it('the message goes by WhatsApp when the store has it, email otherwise, only while pending', async () => {
    const s = await seedStore()
    const o = await seedOrder(s, { verification: 'pending' })
    const email = { id: 'ses', requires: 'email' } as unknown as NotificationChannel
    const wa = { id: 'whatsapp', requires: 'phone' } as unknown as NotificationChannel
    const input = {
      channels: [email, wa],
      to: { email: 'asha@example.com', phone: `91${PHONE}` },
      storefrontUrl: 'https://shop.example',
      secret: SECRET,
    }
    const message = { orderId: o.id, template: 'cod_confirm' as const }
    const both = await inStore(s.storeId, (ctx) => codConfirmDelivery(ctx, message, input))
    expect(both?.channels.map((c) => c.id)).toEqual(['whatsapp'])
    expect(both?.actionUrl).toMatch(/^https:\/\/shop\.example\/cod\//)
    const noPhone = await inStore(s.storeId, (ctx) =>
      codConfirmDelivery(ctx, message, { ...input, to: { email: 'asha@example.com' } }),
    )
    expect(noPhone?.channels.map((c) => c.id)).toEqual(['ses'])
    const other = await inStore(s.storeId, (ctx) =>
      codConfirmDelivery(ctx, { orderId: o.id, template: 'order_placed' }, input),
    )
    expect(other?.channels).toHaveLength(2)
    await owner.update(order).set({ codVerification: 'confirmed' }).where(eq(order.id, o.id))
    expect(await inStore(s.storeId, (ctx) => codConfirmDelivery(ctx, message, input))).toBeNull()
  })

  it('keeps other stores out (RLS)', async () => {
    const a = await seedStore()
    const b = await seedStore()
    const o = await seedOrder(a, { verification: 'pending' })
    const token = codConfirmToken(o.id, SECRET)
    expect(await inStore(b.storeId, (ctx) => codConfirmView(ctx, token, SECRET))).toBeNull()
    const [row] = await owner
      .select()
      .from(order)
      .where(and(eq(order.id, o.id), eq(order.storeId, a.storeId)))
    expect(row?.codVerification).toBe('pending')
  })
})
