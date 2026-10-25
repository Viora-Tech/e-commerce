import {
  cart,
  cartLine,
  createDb,
  giftCard,
  giftCardTransaction,
  inventoryLevel,
  notification,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { refundPayment } from '../order/refund'
import { cancelOrder } from '../order/status'
import { CodPaymentProvider } from '../providers/cod'
import { FakePaymentProvider } from '../providers/payment'
import { addMonths, generateGiftCardCode, giftCardState, normaliseGiftCardCode } from './client'
import {
  changeGiftCardBalance,
  deliverGiftCard,
  findRedeemableGiftCard,
  GiftCardError,
  getGiftCard,
  hashGiftCardCode,
  issueGiftCard,
  issueGiftCardsForOrder,
  listGiftCards,
  redeemGiftCards,
  setGiftCardDisabled,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function makeStore(slug = 'waimers') {
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function makeVariant(storeId: string, opts: { pricePaise: number; giftCard?: boolean }) {
  const [p] = await owner
    .insert(product)
    .values({
      storeId,
      handle: `p-${Math.random().toString(36).slice(2)}`,
      title: opts.giftCard ? 'Gift card' : 'Mouse',
      status: 'active',
      isGiftCard: opts.giftCard ?? false,
    })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p.id, title: 'Default', pricePaise: opts.pricePaise })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId, variantId: v.id, onHand: 100 })
  return v.id
}

async function makeCart(
  storeId: string,
  lines: { variantId: string; quantity: number; pricePaise: number }[],
) {
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('seed')
  for (const l of lines) {
    await owner.insert(cartLine).values({
      storeId,
      cartId: c.id,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPricePaise: l.pricePaise,
    })
  }
  return c.id
}

const issue = (storeId: string, valuePaise: number, extra: { expiresOn?: string } = {}) =>
  withStore(app, storeId, async (tx) => {
    const r = await issueGiftCard({ storeId, tx }, { valuePaise, ...extra }, SECRET)
    if (!r) throw new Error('not issued')
    return r
  })

const balanceOf = async (id: string) =>
  (await owner.select().from(giftCard).where(eq(giftCard.id, id)))[0]?.balancePaise

class FakeEmail implements NotificationChannel {
  readonly id = 'fake-email'
  readonly label = 'Fake email'
  readonly requires = 'email' as const
  readonly sent: Message[] = []
  async send(message: Message) {
    this.sent.push(message)
    return { ok: true as const, providerRef: `m_${this.sent.length}` }
  }
}

describe('gift card codes', () => {
  it('generates 12 unambiguous characters and hashes them per store', () => {
    const code = generateGiftCardCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/)
    expect(hashGiftCardCode('a', code)).toBe(hashGiftCardCode('a', code.toLowerCase()))
    expect(hashGiftCardCode('a', code)).not.toBe(hashGiftCardCode('b', code))
    expect(normaliseGiftCardCode('abcd-efgh 2345')).toBe('ABCDEFGH2345')
  })

  it('never stores the code in the clear and shows only the last four', async () => {
    const storeId = await makeStore()
    const { card, code } = await issue(storeId, 100000)
    const [row] = await owner.select().from(giftCard).where(eq(giftCard.id, card.id))
    expect(row?.lastCharacters).toBe(code.slice(-4))
    expect(JSON.stringify(row)).not.toContain(code)
    const [t] = await owner
      .select()
      .from(giftCardTransaction)
      .where(eq(giftCardTransaction.giftCardId, card.id))
    expect(t).toMatchObject({ kind: 'issue', amountPaise: 100000, balanceAfterPaise: 100000 })
  })

  it('looks a code up with spaces and lower case, and says why a card cannot be used', async () => {
    const storeId = await makeStore()
    const { card, code } = await issue(storeId, 50000)
    const typed = code.toLowerCase().replace(/(.{4})/g, '$1 ')
    const found = await withStore(app, storeId, (tx) =>
      findRedeemableGiftCard({ storeId, tx }, typed),
    )
    expect(found).toMatchObject({ id: card.id, balancePaise: 50000 })

    await withStore(app, storeId, (tx) => setGiftCardDisabled({ storeId, tx }, card.id, true))
    await expect(
      withStore(app, storeId, (tx) => findRedeemableGiftCard({ storeId, tx }, code)),
    ).rejects.toMatchObject({ reason: 'disabled' })
    await expect(
      withStore(app, storeId, (tx) => findRedeemableGiftCard({ storeId, tx }, 'NOPE-NOPE-NOPE')),
    ).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('treats a card as expired the day after its expiry date', () => {
    const card = { disabledAt: null, expiresOn: '2026-09-22', balancePaise: 100 }
    expect(giftCardState(card, '2026-09-22')).toBe('active')
    expect(giftCardState(card, '2026-09-23')).toBe('expired')
    expect(giftCardState({ ...card, balancePaise: 0 }, '2026-09-01')).toBe('empty')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-09-23', 12)).toBe('2027-09-23')
  })

  it('refuses a custom code another card already uses, and cards from other stores stay invisible', async () => {
    const a = await makeStore('a')
    const b = await makeStore('b')
    await withStore(app, a, (tx) =>
      issueGiftCard({ storeId: a, tx }, { valuePaise: 1000, code: 'DIWALI2026' }, SECRET),
    )
    await expect(
      withStore(app, a, (tx) =>
        issueGiftCard({ storeId: a, tx }, { valuePaise: 1000, code: 'diwali-2026' }, SECRET),
      ),
    ).rejects.toMatchObject({ reason: 'code_taken' })
    await expect(
      withStore(app, b, (tx) => findRedeemableGiftCard({ storeId: b, tx }, 'DIWALI2026')),
    ).rejects.toMatchObject({ reason: 'not_found' })
    const list = await withStore(app, b, (tx) => listGiftCards({ storeId: b, tx }))
    expect(list.total).toBe(0)
  })
})

describe('balance', () => {
  it('adjusts with a note and never goes below zero', async () => {
    const storeId = await makeStore()
    const { card } = await issue(storeId, 10000)
    await withStore(app, storeId, (tx) =>
      changeGiftCardBalance(
        { storeId, tx },
        { giftCardId: card.id, amountPaise: -4000, kind: 'adjustment', note: 'goodwill fix' },
      ),
    )
    expect(await balanceOf(card.id)).toBe(6000)
    await expect(
      withStore(app, storeId, (tx) =>
        changeGiftCardBalance(
          { storeId, tx },
          { giftCardId: card.id, amountPaise: -7000, kind: 'adjustment' },
        ),
      ),
    ).rejects.toBeInstanceOf(GiftCardError)
    const detail = await withStore(app, storeId, (tx) => getGiftCard({ storeId, tx }, card.id))
    expect(detail?.transactions.map((t) => [t.kind, t.amountPaise, t.balanceAfterPaise])).toEqual([
      ['adjustment', -4000, 6000],
      ['issue', 10000, 10000],
    ])
  })

  it('never double spends under concurrent redemptions', async () => {
    const storeId = await makeStore()
    const { card } = await issue(storeId, 10000)
    const orders = await owner
      .insert(order)
      .values(
        Array.from({ length: 8 }, (_, i) => ({
          storeId,
          number: i + 1,
          subtotalPaise: 3000,
          totalPaise: 3000,
        })),
      )
      .returning({ id: order.id })
    const results = await Promise.allSettled(
      orders.map((o) =>
        withStore(app, storeId, (tx) =>
          redeemGiftCards(
            { storeId, tx },
            { orderId: o.id, giftCardIds: [card.id], amountDuePaise: 3000 },
          ),
        ),
      ),
    )
    const spent = results
      .filter((r) => r.status === 'fulfilled')
      .reduce((n, r) => n + (r.status === 'fulfilled' ? r.value.redeemedPaise : 0), 0)
    // 3000 + 3000 + 3000 + 1000, then the card is empty and the rest are refused.
    expect(spent).toBe(10000)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4)
    expect(await balanceOf(card.id)).toBe(0)
    const ledger = await owner
      .select()
      .from(giftCardTransaction)
      .where(eq(giftCardTransaction.giftCardId, card.id))
    expect(ledger.reduce((n, t) => n + t.amountPaise, 0)).toBe(0)
    const paid = await owner.select().from(payment).where(eq(payment.provider, 'gift_card'))
    expect(paid.reduce((n, p) => n + p.amountPaise, 0)).toBe(10000)
  })
})

describe('checkout', () => {
  it('pays the whole order from a gift card without calling the provider', async () => {
    const storeId = await makeStore()
    const v = await makeVariant(storeId, { pricePaise: 20000 })
    const cartId = await makeCart(storeId, [{ variantId: v, quantity: 1, pricePaise: 20000 }])
    const { card } = await issue(storeId, 50000)
    const provider = new FakePaymentProvider()
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: provider,
      giftCardIds: [card.id],
    })
    expect(provider.calls).toEqual([])
    expect(r.paymentStatus).toBe('captured')
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o).toMatchObject({
      status: 'open',
      paymentStatus: 'paid',
      paymentMethod: 'gift_card',
      totalPaise: 20000,
    })
    expect(await balanceOf(card.id)).toBe(30000)
  })

  it('charges the provider only for what the card does not cover, and refunds go back to the card', async () => {
    const storeId = await makeStore()
    const v = await makeVariant(storeId, { pricePaise: 20000 })
    const cartId = await makeCart(storeId, [{ variantId: v, quantity: 1, pricePaise: 20000 }])
    const { card } = await issue(storeId, 5000)
    const provider = new FakePaymentProvider()
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: provider,
      giftCardIds: [card.id],
    })
    expect(provider.calls[0]).toBe(`createPayment:${r.orderId}:15000`)
    const pays = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pays.map((p) => [p.provider, p.amountPaise]).sort()).toEqual([
      ['fake', 15000],
      ['gift_card', 5000],
    ])
    expect(await balanceOf(card.id)).toBe(0)
    // GST is on the full order: a gift card is a payment, not a discount.
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.taxPaise).toBeGreaterThan(0)

    const gcPay = pays.find((p) => p.provider === 'gift_card')
    if (!gcPay) throw new Error('no gift card payment')
    const refund = await withStore(app, storeId, (tx) =>
      refundPayment({ storeId, tx }, null, { paymentId: gcPay.id, amountPaise: 2000 }),
    )
    expect(refund?.status).toBe('processed')
    expect(await balanceOf(card.id)).toBe(2000)
  })

  it('cancelling an order returns what it took from the gift card, once', async () => {
    const storeId = await makeStore()
    const v = await makeVariant(storeId, { pricePaise: 20000 })
    const cartId = await makeCart(storeId, [{ variantId: v, quantity: 1, pricePaise: 20000 }])
    const { card } = await issue(storeId, 8000)
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider(),
      giftCardIds: [card.id],
    })
    expect(await balanceOf(card.id)).toBe(0)
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    expect(await balanceOf(card.id)).toBe(8000)
  })

  it('refuses COD for a balance left after the gift card and leaves the card untouched', async () => {
    const storeId = await makeStore()
    const v = await makeVariant(storeId, { pricePaise: 20000 })
    const cartId = await makeCart(storeId, [{ variantId: v, quantity: 1, pricePaise: 20000 }])
    const { card } = await issue(storeId, 5000)
    await expect(
      placeOrderAndPay(app, storeId, {
        cartId,
        paymentProvider: new CodPaymentProvider(),
        giftCardIds: [card.id],
      }),
    ).rejects.toMatchObject({ reason: 'not_allowed' })
    expect(await balanceOf(card.id)).toBe(5000)
    expect(await owner.select().from(order)).toEqual([])
  })

  it('sells gift cards on their own, tax free, and not for COD or another gift card', async () => {
    const storeId = await makeStore()
    const gc = await makeVariant(storeId, { pricePaise: 100000, giftCard: true })
    const mouse = await makeVariant(storeId, { pricePaise: 20000 })
    const mixed = await makeCart(storeId, [
      { variantId: gc, quantity: 1, pricePaise: 100000 },
      { variantId: mouse, quantity: 1, pricePaise: 20000 },
    ])
    await expect(
      placeOrderAndPay(app, storeId, { cartId: mixed, paymentProvider: new FakePaymentProvider() }),
    ).rejects.toMatchObject({ reason: 'not_allowed' })
    const only = await makeCart(storeId, [{ variantId: gc, quantity: 2, pricePaise: 100000 }])
    await expect(
      placeOrderAndPay(app, storeId, { cartId: only, paymentProvider: new CodPaymentProvider() }),
    ).rejects.toMatchObject({ reason: 'not_allowed' })

    const r = await placeOrderAndPay(app, storeId, {
      cartId: only,
      paymentProvider: new FakePaymentProvider(),
    })
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o).toMatchObject({ taxPaise: 0, totalPaise: 200000, paymentStatus: 'paid' })
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, r.orderId))
    expect(line).toMatchObject({ giftCard: true, gstRatePercent: 0 })
    const [inv] = await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, gc))
    expect(inv?.reserved).toBe(0)
  })
})

describe('issuing sold cards', () => {
  it('issues one card per unit once the order is paid, idempotently, and emails each code', async () => {
    const storeId = await makeStore()
    await owner
      .update(store)
      .set({ giftCards: { expiryMonths: 12 } })
      .where(eq(store.id, storeId))
    const gc = await makeVariant(storeId, { pricePaise: 100000, giftCard: true })
    const cartId = await makeCart(storeId, [{ variantId: gc, quantity: 2, pricePaise: 100000 }])
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider(),
      checkout: {
        email: 'Buyer@Example.com',
        phone: '9876543210',
        name: 'Asha',
        address: { line1: 'x', city: 'Pune', stateCode: 'MH', pincode: '411001' },
      },
    })
    const first = await withStore(app, storeId, (tx) =>
      issueGiftCardsForOrder({ storeId, tx }, r.orderId, SECRET),
    )
    const again = await withStore(app, storeId, (tx) =>
      issueGiftCardsForOrder({ storeId, tx }, r.orderId, SECRET),
    )
    expect(first).toHaveLength(2)
    expect(again).toEqual([])
    const cards = await owner.select().from(giftCard).where(eq(giftCard.orderId, r.orderId))
    expect(cards.map((c) => [c.source, c.balancePaise, c.recipientEmail])).toEqual([
      ['purchase', 100000, 'buyer@example.com'],
      ['purchase', 100000, 'buyer@example.com'],
    ])
    expect(cards[0]?.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    // Gift cards only: paid and issued, so nothing is left to do.
    expect(o).toMatchObject({ status: 'completed', fulfillmentStatus: 'fulfilled' })

    const email = new FakeEmail()
    const first0 = cards[0]
    if (!first0) throw new Error('no card')
    const sent = await withStore(app, storeId, (tx) =>
      deliverGiftCard({ storeId, tx }, first0.id, { channels: [email], secret: SECRET }),
    )
    expect(sent[0]?.ok).toBe(true)
    const code = email.sent[0]?.data.giftCard?.code.replace(/ /g, '') ?? ''
    expect(code.slice(-4)).toBe(first0.lastCharacters)
    const found = await withStore(app, storeId, (tx) =>
      findRedeemableGiftCard({ storeId, tx }, code),
    )
    expect(found.id).toBe(first0.id)
    const log = await owner.select().from(notification)
    expect(log.map((n) => n.template)).toEqual(['gift_card_issued'])
  })

  it('does not issue cards for an order that is not paid', async () => {
    const storeId = await makeStore()
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, subtotalPaise: 1000, totalPaise: 1000 })
      .returning()
    if (!o) throw new Error('seed')
    expect(
      await withStore(app, storeId, (tx) => issueGiftCardsForOrder({ storeId, tx }, o.id, SECRET)),
    ).toEqual([])
  })
})
