/** SOURCE OF TRUTH: tests for unpaid checkouts as drafts — WHAT: an online or transfer checkout is a draft (#D) until paid, converts in place on capture, is used again for the same items, expires after 7 days, and COD stays an order / WHY: these rules decide whether a checkout takes an order number */
import {
  cart,
  cartLine,
  createDb,
  fulfillmentOrder,
  inventoryLevel,
  order,
  orderNote,
  outboxEvent,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { retryPayment } from '../payments/attempts'
import { applyPaymentStatus, LATE_CAPTURE_NOTE } from '../payments/confirm'
import { GatewayDouble } from '../payments/gateway-double.test-util'
import { readShopperPaid } from '../payments/shopper-paid'
import { orderViewToken } from '../preorder/balance-link'
import { ManualPaymentProvider } from '../providers/manual'
import { FakePaymentProvider } from '../providers/payment'
import {
  CHECKED_OUT_AGAIN_NOTE,
  expireCheckoutDrafts,
  ORDERED_INSTEAD_NOTE,
  recordShopperPaid,
  shopperPaidNote,
} from './checkout-draft'
import { listDrafts } from './draft-list'
import { releaseExpiredDraftHolds } from './draft-reserve'
import { convertDraft } from './drafts'
import { DuplicateCheckout } from './duplicate-checkout'
import { placeOrderAndPay } from './place-order'
import { viewableOrderId } from './view-access'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const HOUR = 3_600_000
const transfer = new ManualPaymentProvider({ upiId: 'shop@hdfcbank', payeeName: 'Shop' })
const cod = () => new FakePaymentProvider({ mode: 'capture', id: 'cod' })

type Shop = { storeId: string; keyboard: string; pad: string }

async function seedShop(opts: { drafts?: 'on' | 'off'; onHand?: number } = {}): Promise<Shop> {
  const payments = opts.drafts ? { unpaidAsDrafts: opts.drafts } : null
  const [s] = await owner
    .insert(store)
    .values({ slug: 'waimers', name: 'Waimers', payments })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'keyboard', title: 'Keyboard', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [keyboard, pad] = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p.id, title: 'Keyboard', pricePaise: 2689900 },
      { storeId: s.id, productId: p.id, title: 'Pad', pricePaise: 5000 },
    ])
    .returning()
  if (!keyboard || !pad) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: keyboard.id, onHand: opts.onHand ?? 10 },
    { storeId: s.id, variantId: pad.id, onHand: 10 },
  ])
  return { storeId: s.id, keyboard: keyboard.id, pad: pad.id }
}

async function cartWith(shop: Shop, lines: { variantId: string; quantity: number }[]) {
  const [c] = await owner.insert(cart).values({ storeId: shop.storeId }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values(
      lines.map((l) => ({ storeId: shop.storeId, cartId: c.id, unitPricePaise: 2689900, ...l })),
    )
  return c.id
}

const rudra = { email: 'rudra@example.com', phone: '9876543210' }

function checkout(who: { email: string; phone: string }) {
  return {
    name: 'Shopper',
    ...who,
    address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
  }
}

async function checkoutOnline(
  shop: Shop,
  lines: { variantId: string; quantity: number }[],
  who = rudra,
  provider: import('../providers/payment').PaymentProvider = new GatewayDouble(),
) {
  const cartId = await cartWith(shop, lines)
  return placeOrderAndPay(app, shop.storeId, {
    cartId,
    paymentProvider: provider,
    checkout: checkout(who),
  })
}

const orderRow = async (id: string) => (await owner.select().from(order).where(eq(order.id, id)))[0]

const reservedOf = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.reserved

async function capture(storeId: string, paymentId: string) {
  return withStore(app, storeId, (tx) =>
    applyPaymentStatus(
      { storeId, tx },
      { paymentId, status: 'captured', providerPaymentId: `pay_${paymentId}` },
    ),
  )
}

async function setActivity(id: string, at: Date) {
  await owner.update(order).set({ lastActivityAt: at, placedAt: at }).where(eq(order.id, id))
}

describe('unpaid checkouts as drafts', () => {
  it('keeps an online checkout as a draft with a #D number, holding no stock until paid', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const gw = new GatewayDouble()
    const r = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }], rudra, gw)

    expect(r.draftNumber).toBe(1)
    expect(r.orderNumber).toBe(-1)
    const o = await orderRow(r.orderId)
    expect(o).toMatchObject({
      status: 'draft',
      draftSource: 'checkout',
      draftNumber: 1,
      number: -1,
      totalPaise: 2689900,
    })
    expect(o?.lastActivityAt).toBeInstanceOf(Date)
    // Stock is reserved only for paid orders (owner, 10 Nov 2026).
    expect(o?.reservedUntil).toBeNull()
    expect(o?.draftReserved).toBeNull()
    expect(await reservedOf(shop.keyboard)).toBe(0)
    // No parcels and no "order placed" until it is paid; the gateway sees the draft number.
    expect(
      await owner.select().from(fulfillmentOrder).where(eq(fulfillmentOrder.orderId, r.orderId)),
    ).toHaveLength(0)
    expect(gw.created[0]).toMatchObject({ orderNumber: undefined, draftNumber: 1 })
    const events = await owner
      .select()
      .from(outboxEvent)
      .where(eq(outboxEvent.storeId, shop.storeId))
    expect(events.map((e) => e.type)).not.toContain('order.placed')
  })

  it('converts the draft in place into order #1 when the payment is captured, once', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const r = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    if (!r.attemptId) throw new Error('attempt')

    const first = await capture(shop.storeId, r.attemptId)
    expect(first).toMatchObject({ becameCaptured: true, refundNeeded: false })
    const again = await capture(shop.storeId, r.attemptId)
    expect(again?.becameCaptured).toBe(false)

    const o = await orderRow(r.orderId)
    expect(o).toMatchObject({
      status: 'open',
      number: 1,
      draftNumber: 1,
      paymentStatus: 'paid',
      draftReserved: null,
      reservedUntil: null,
    })
    expect(o?.checkoutPaidAt).toBeInstanceOf(Date)
    // Held once, for the order, on its parcel.
    expect(await reservedOf(shop.keyboard)).toBe(1)
    expect(
      await owner.select().from(fulfillmentOrder).where(eq(fulfillmentOrder.orderId, r.orderId)),
    ).toHaveLength(1)
    const placed = await owner
      .select()
      .from(outboxEvent)
      .where(and(eq(outboxEvent.storeId, shop.storeId), eq(outboxEvent.type, 'order.placed')))
    expect(placed).toHaveLength(1)
    // The shopper's #D1 link still opens it, now as order #1.
    const viewer = { customerId: null, token: orderViewToken(r.orderId, 'test-secret') }
    for (const ref of ['D1', '-1', 1]) {
      expect(
        await withStore(app, shop.storeId, (tx) => viewableOrderId(tx, ref, viewer, 'test-secret')),
      ).toBe(r.orderId)
    }
  })

  it('a capture after the hold lapsed and the stock sold is flagged refund needed', async () => {
    const shop = await seedShop({ drafts: 'on', onHand: 1 })
    const r = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    if (!r.attemptId) throw new Error('attempt')
    // The hold runs out, and someone else buys the last one by cash on delivery.
    await owner
      .update(order)
      .set({ reservedUntil: new Date(Date.now() - 1000) })
      .where(eq(order.id, r.orderId))
    await withStore(app, shop.storeId, (tx) =>
      releaseExpiredDraftHolds({ storeId: shop.storeId, tx }),
    )
    expect(await reservedOf(shop.keyboard)).toBe(0)
    await checkoutOnline(
      shop,
      [{ variantId: shop.keyboard, quantity: 1 }],
      { email: 'asha@example.com', phone: '9123456780' },
      cod(),
    )

    const applied = await capture(shop.storeId, r.attemptId)
    expect(applied).toMatchObject({ becameCaptured: false, refundNeeded: true })
    const o = await orderRow(r.orderId)
    expect(o?.status).toBe('draft')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, r.orderId))
    expect(notes.map((n) => n.body)).toContain(LATE_CAPTURE_NOTE)
    const list = await withStore(app, shop.storeId, (tx) =>
      listDrafts({ storeId: shop.storeId, tx }, { source: 'checkout', page: 1, perPage: 10 }),
    )
    expect(list.items[0]).toMatchObject({ id: r.orderId, refundNeeded: true })
  })

  it('cash on delivery is an order at once, and so is everything with the switch off', async () => {
    const on = await seedShop({ drafts: 'on' })
    const r1 = await checkoutOnline(on, [{ variantId: on.keyboard, quantity: 1 }], rudra, cod())
    expect(r1.draftNumber).toBeNull()
    expect((await orderRow(r1.orderId))?.status).toBe('open')

    await resetDb(owner)
    const off = await seedShop({ drafts: 'off' })
    const r2 = await checkoutOnline(off, [{ variantId: off.keyboard, quantity: 1 }])
    expect(r2.draftNumber).toBeNull()
    expect(await orderRow(r2.orderId)).toMatchObject({ status: 'open', number: 1 })
  })

  it('cash on delivery for the items of an open draft closes the draft', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const draft = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    const placed = await checkoutOnline(
      shop,
      [{ variantId: shop.keyboard, quantity: 1 }],
      rudra,
      cod(),
    )
    expect(await orderRow(placed.orderId)).toMatchObject({ status: 'open', number: 1 })
    const closed = await orderRow(draft.orderId)
    expect(closed?.draftExpiredAt).toBeInstanceOf(Date)
    expect(closed?.draftReserved).toBeNull()
    expect(await reservedOf(shop.keyboard)).toBe(1)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, draft.orderId))
    expect(notes.map((n) => n.body)).toContain(ORDERED_INSTEAD_NOTE)
  })

  it('the kill switch makes new checkouts orders again', async () => {
    const shop = await seedShop({ drafts: 'on' })
    process.env.CHECKOUT_DRAFTS = 'off'
    try {
      const r = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
      expect(r.draftNumber).toBeNull()
      expect((await orderRow(r.orderId))?.status).toBe('open')
    } finally {
      delete process.env.CHECKOUT_DRAFTS
    }
  })

  it('retries a failed payment on the same draft', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const r = await checkoutOnline(
      shop,
      [{ variantId: shop.keyboard, quantity: 1 }],
      rudra,
      new FakePaymentProvider({ mode: 'fail' }),
    )
    expect(r.paymentError).toBeTruthy()
    const retried = await withStore(app, shop.storeId, (tx) =>
      retryPayment({ storeId: shop.storeId, tx }, r.orderId),
    )
    expect(retried).toMatchObject({ created: true, attempt: { attempt: 2, orderId: r.orderId } })
  })
})

describe('the same shopper checking out again', () => {
  it('same items after 3 hours: the same draft, its activity bumped and noted, and it moves to the top', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const first = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    const other = await checkoutOnline(shop, [{ variantId: shop.pad, quantity: 1 }])
    await setActivity(first.orderId, new Date(Date.now() - 3 * HOUR))
    await setActivity(other.orderId, new Date(Date.now() - 2 * HOUR))
    const before = await withStore(app, shop.storeId, (tx) =>
      listDrafts({ storeId: shop.storeId, tx }, { source: 'checkout', page: 1, perPage: 10 }),
    )
    expect(before.items.map((d) => d.id)).toEqual([other.orderId, first.orderId])

    const again = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])

    expect(again).toMatchObject({ orderId: first.orderId, draftNumber: 1, resumedDraft: true })
    const o = await orderRow(first.orderId)
    expect(o?.lastActivityAt?.getTime()).toBeGreaterThan(Date.now() - 60_000)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, first.orderId))
    expect(notes.map((n) => n.body)).toContain(CHECKED_OUT_AGAIN_NOTE)
    // An unpaid checkout draft holds no stock, before or after checking out again.
    expect(await reservedOf(shop.keyboard)).toBe(0)
    const after = await withStore(app, shop.storeId, (tx) =>
      listDrafts({ storeId: shop.storeId, tx }, { source: 'checkout', page: 1, perPage: 10 }),
    )
    expect(after.items.map((d) => d.id)).toEqual([first.orderId, other.orderId])
    expect(after.total).toBe(2)
    // The first attempt was replaced; the new one is attempt 2 on the same draft.
    const pays = await owner.select().from(payment).where(eq(payment.orderId, first.orderId))
    expect(pays.map((p) => [p.attempt, p.status]).sort()).toEqual([
      [1, 'cancelled'],
      [2, 'pending'],
    ])
  })

  it('same items, a different email but the same phone: the existing draft, no new one', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const first = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    const again = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }], {
      email: 'valorant.rudra@example.com',
      phone: '+91 98765 43210',
    })
    expect(again).toMatchObject({ orderId: first.orderId, draftNumber: 1, resumedDraft: true })
    const drafts = await owner.select().from(order).where(eq(order.storeId, shop.storeId))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.email).toBe('valorant.rudra@example.com')
  })

  it('different items: a second draft, the first untouched', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const first = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    const second = await checkoutOnline(shop, [{ variantId: shop.pad, quantity: 1 }])
    expect(second.orderId).not.toBe(first.orderId)
    expect(second).toMatchObject({ draftNumber: 2, resumedDraft: false })
    expect(await orderRow(first.orderId)).toMatchObject({ status: 'draft', draftNumber: 1 })
  })

  it('same items after 25 hours with no activity: a new draft', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const first = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    await setActivity(first.orderId, new Date(Date.now() - 25 * HOUR))
    const again = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    expect(again.orderId).not.toBe(first.orderId)
    expect(again).toMatchObject({ draftNumber: 2, resumedDraft: false })
  })

  it('with the switch off, an open draft with the same items still sends the shopper to it', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const first = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    await owner
      .update(store)
      .set({ payments: { unpaidAsDrafts: 'off' } })
      .where(eq(store.id, shop.storeId))
    const err = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }]).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(DuplicateCheckout)
    expect((err as DuplicateCheckout).kind).toBe('unpaid')
    expect((err as DuplicateCheckout).order).toMatchObject({ id: first.orderId, draftNumber: 1 })
  })
})

describe('UPI and bank transfer checkouts', () => {
  it('stay drafts until marked paid, then become an order and announce it', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const r = await checkoutOnline(
      shop,
      [{ variantId: shop.keyboard, quantity: 1 }],
      rudra,
      transfer,
    )
    expect((await orderRow(r.orderId))?.status).toBe('draft')
    // Nothing is held while the transfer is unconfirmed: stock is taken when it is marked paid.
    expect((await orderRow(r.orderId))?.reservedUntil).toBeNull()
    expect(await reservedOf(shop.keyboard)).toBe(0)
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    if (!p) throw new Error('attempt')

    await capture(shop.storeId, p.id)

    expect(await orderRow(r.orderId)).toMatchObject({ status: 'open', number: 1 })
    const types = (
      await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, shop.storeId))
    ).map((e) => e.type)
    expect(types).toContain('order.placed')
    expect(types).toContain('order.paid')
  })

  it('tells the shopper it is received, quotes #D1, and keeps their I have paid and UTR', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const r = await checkoutOnline(
      shop,
      [{ variantId: shop.keyboard, quantity: 1 }],
      rudra,
      transfer,
    )
    const types = (
      await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, shop.storeId))
    ).map((e) => e.type)
    expect(types).toContain('order.transfer_requested')
    expect(types).not.toContain('order.placed')
    const [p] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(p?.checkoutSession).toMatchObject({
      kind: 'manual',
      instructions: { reference: 'Order D1' },
    })

    const said = await withStore(app, shop.storeId, (tx) =>
      recordShopperPaid({ storeId: shop.storeId, tx }, r.orderId, ' 4123 4567 8901 '),
    )
    expect(said).toBe(true)
    const again = await withStore(app, shop.storeId, (tx) =>
      recordShopperPaid({ storeId: shop.storeId, tx }, r.orderId, 'x'),
    )
    expect(again).toBe(false)
    const [after] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(readShopperPaid(after?.checkoutSession)?.utr).toBe('412345678901')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, r.orderId))
    expect(notes.map((n) => n.body)).toContain(shopperPaidNote('412345678901'))
    const list = await withStore(app, shop.storeId, (tx) =>
      listDrafts({ storeId: shop.storeId, tx }, { source: 'checkout', page: 1, perPage: 10 }),
    )
    expect(list.items[0]).toMatchObject({ id: r.orderId, shopperPaid: true })
  })

  it('"Convert to order (unpaid)" places it with its transfer still to pay', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const r = await checkoutOnline(
      shop,
      [{ variantId: shop.keyboard, quantity: 1 }],
      rudra,
      transfer,
    )
    const placed = await withStore(app, shop.storeId, (tx) =>
      convertDraft({ storeId: shop.storeId, tx }, r.orderId),
    )
    expect(placed).toMatchObject({ status: 'open', number: 1, paymentStatus: 'unpaid' })
    const pays = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pays).toHaveLength(1)
    expect(pays[0]?.status).toBe('pending')
    expect(await reservedOf(shop.keyboard)).toBe(1)
  })
})

describe('expiry', () => {
  it('a checkout draft with no activity for 7 days stops waiting and gives its stock back', async () => {
    const shop = await seedShop({ drafts: 'on' })
    const r = await checkoutOnline(shop, [{ variantId: shop.keyboard, quantity: 1 }])
    await owner
      .update(order)
      .set({
        lastActivityAt: new Date(Date.now() - 8 * 24 * HOUR),
        reservedUntil: new Date(Date.now() + HOUR),
      })
      .where(eq(order.id, r.orderId))
    const expired = await withStore(app, shop.storeId, (tx) =>
      expireCheckoutDrafts({ storeId: shop.storeId, tx }),
    )
    expect(expired).toBe(1)
    const o = await orderRow(r.orderId)
    expect(o?.draftExpiredAt).toBeInstanceOf(Date)
    expect(o?.draftReserved).toBeNull()
    expect(await reservedOf(shop.keyboard)).toBe(0)
    const list = await withStore(app, shop.storeId, (tx) =>
      listDrafts({ storeId: shop.storeId, tx }, { source: 'checkout', page: 1, perPage: 10 }),
    )
    expect(list.total).toBe(0)
    await expect(
      withStore(app, shop.storeId, (tx) => retryPayment({ storeId: shop.storeId, tx }, r.orderId)),
    ).rejects.toThrow(/expired/)
  })
})
