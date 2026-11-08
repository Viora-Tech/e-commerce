/** SOURCE OF TRUTH: store credit at checkout tests — WHAT: partial and full cover, concurrent checkouts never overspend, a failed or expired payment gives the credit back, refunds go back onto the balance, a shopper never spends someone else's credit, and GST is unchanged / WHY: store credit is the customer's own money, so every checkout path must leave the balance exact */
import {
  cart,
  cartLine,
  createDb,
  customer,
  inventoryLevel,
  order,
  payment,
  product,
  store,
  storeCreditAccount,
  storeCreditEntry,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrder, placeOrderAndPay } from '../order/place-order'
import { refundPayment } from '../order/refund'
import { cancelOrder } from '../order/status'
import { applyPaymentStatus } from '../payments/confirm'
import { expireUnpaidOrder } from '../payments/expiry'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { FakePaymentProvider } from '../providers/payment'
import { changeStoreCredit, StoreCreditError, shopperStoreCredit } from './store-credit'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const PRICE = 499_900
const EMAIL = 'shriram@example.com'

const checkoutAs = (email: string) => ({
  name: 'Shriram V',
  email,
  phone: '9999999999',
  address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
})

async function seedStore() {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: PRICE })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: EMAIL, name: 'Shriram V' })
    .returning()
  if (!cu) throw new Error('seed')
  return { storeId: s.id, variantId: v.id, customerId: cu.id }
}

async function makeCart(storeId: string, variantId: string): Promise<string> {
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId, cartId: c.id, variantId, quantity: 1, unitPricePaise: PRICE })
  return c.id
}

async function giveCredit(storeId: string, customerId: string, amountPaise: number) {
  await withStore(app, storeId, (tx) =>
    changeStoreCredit(
      { storeId, tx },
      { customerId, amountPaise, kind: 'adjustment', reason: 'Moved from gift card G49E' },
    ),
  )
}

async function balanceOf(customerId: string): Promise<number> {
  const [a] = await owner
    .select({ balancePaise: storeCreditAccount.balancePaise })
    .from(storeCreditAccount)
    .where(eq(storeCreditAccount.customerId, customerId))
  return a?.balancePaise ?? 0
}

const creditPayments = (orderId: string) =>
  owner
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), eq(payment.provider, STORE_CREDIT_PROVIDER)))

describe('store credit at checkout', () => {
  it('pays part of the order, holds it until the gateway is paid, then captures it', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 100_000)
    const cartId = await makeCart(storeId, variantId)
    const provider = new FakePaymentProvider()

    const r = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: provider,
          checkout: checkoutAs(EMAIL),
          storeCredit: { customerId },
        },
      ),
    )

    // The balance is taken when the order is placed, so nothing else can spend it.
    expect(await balanceOf(customerId)).toBe(0)
    const [held] = await creditPayments(r.orderId)
    expect(held).toMatchObject({ status: 'pending', amountPaise: 100_000 })
    const [attempt] = await owner
      .select()
      .from(payment)
      .where(eq(payment.id, r.attemptId ?? ''))
    expect(attempt?.amountPaise).toBe(PRICE - 100_000)
    const [placed] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(placed?.paymentStatus).toBe('unpaid')
    // The ledger line links to the order.
    const [line] = await owner
      .select()
      .from(storeCreditEntry)
      .where(and(eq(storeCreditEntry.customerId, customerId), eq(storeCreditEntry.kind, 'payment')))
    expect(line).toMatchObject({ amountPaise: -100_000, orderId: r.orderId, balanceAfterPaise: 0 })

    // The gateway captures the rest: the hold is the order's money too, and the order is paid.
    await withStore(app, storeId, (tx) =>
      applyPaymentStatus(
        { storeId, tx },
        { paymentId: r.attemptId as string, status: 'captured', providerPaymentId: 'pay_1' },
      ),
    )
    const [paid] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(paid?.paymentStatus).toBe('paid')
    expect(paid?.checkoutPaidAt).not.toBeNull()
    const [captured] = await creditPayments(r.orderId)
    expect(captured?.status).toBe('captured')

    // Cancelling a paid order sends the store credit part back onto the balance.
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    expect(await balanceOf(customerId)).toBe(100_000)
  })

  it('pays the whole order with no gateway when the balance covers it', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 600_000)
    const cartId = await makeCart(storeId, variantId)
    const provider = new FakePaymentProvider()

    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: provider,
      checkout: checkoutAs(EMAIL),
      storeCredit: { customerId },
    })

    expect(provider.calls).toEqual([])
    expect(r.attemptId).toBeNull()
    expect(r.paymentStatus).toBe('captured')
    expect(r.session).toMatchObject({ kind: 'none', provider: STORE_CREDIT_PROVIDER })
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o).toMatchObject({ paymentStatus: 'paid', paymentMethod: STORE_CREDIT_PROVIDER })
    expect(await balanceOf(customerId)).toBe(600_000 - PRICE)
    const pays = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pays).toHaveLength(1)
    expect(pays[0]).toMatchObject({ provider: STORE_CREDIT_PROVIDER, status: 'captured' })

    // A refund of that payment goes back onto the balance, never to a gateway or a card.
    await withStore(app, storeId, (tx) =>
      refundPayment({ storeId, tx }, null, {
        paymentId: pays[0]?.id as string,
        amountPaise: 9_900,
      }),
    )
    expect(await balanceOf(customerId)).toBe(600_000 - PRICE + 9_900)
  })

  it('never spends the same credit twice when two checkouts run at once', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 700_000)
    const carts = await Promise.all([1, 2, 3].map(() => makeCart(storeId, variantId)))

    const results = await Promise.allSettled(
      carts.map((cartId) =>
        withStore(app, storeId, (tx) =>
          placeOrder(
            { storeId, tx },
            {
              cartId,
              paymentProvider: new FakePaymentProvider(),
              checkout: checkoutAs(EMAIL),
              storeCredit: { customerId },
            },
          ),
        ),
      ),
    )
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const spent = await owner
      .select()
      .from(payment)
      .where(eq(payment.provider, STORE_CREDIT_PROVIDER))
    // 4,999 + 2,001 + nothing: the third checkout found the balance empty and paid it all online.
    expect(spent.reduce((n, p) => n + p.amountPaise, 0)).toBe(700_000)
    expect(spent).toHaveLength(2)
    expect(await balanceOf(customerId)).toBe(0)
    const ledger = await owner
      .select()
      .from(storeCreditEntry)
      .where(eq(storeCreditEntry.customerId, customerId))
    expect(ledger.reduce((n, e) => n + e.amountPaise, 0)).toBe(0)
  })

  it('gives held credit back when the payment fails and the unpaid order expires', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 100_000)
    const cartId = await makeCart(storeId, variantId)
    const failing = new FakePaymentProvider({ mode: 'fail' })

    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: failing,
      checkout: checkoutAs(EMAIL),
      storeCredit: { customerId },
    })
    expect(r.paymentError).not.toBeNull()
    // Failed, not cancelled: the shopper may still retry, so the credit stays held.
    expect(await balanceOf(customerId)).toBe(0)

    const out = await expireUnpaidOrder(app, storeId, r.orderId, [failing], 30)
    expect(out.result).toBe('cancelled')
    expect(await balanceOf(customerId)).toBe(100_000)
    const [released] = await creditPayments(r.orderId)
    expect(released?.status).toBe('cancelled')
    const release = await owner
      .select()
      .from(storeCreditEntry)
      .where(and(eq(storeCreditEntry.customerId, customerId), eq(storeCreditEntry.kind, 'release')))
    expect(release).toHaveLength(1)
    expect(release[0]).toMatchObject({ amountPaise: 100_000, orderId: r.orderId })

    // A second cancel gives nothing back twice.
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    expect(await balanceOf(customerId)).toBe(100_000)

    // The shopper's own page names the order, never the staff reason.
    const mine = await withStore(app, storeId, (tx) =>
      shopperStoreCredit({ storeId, tx }, customerId),
    )
    expect(mine.balancePaise).toBe(100_000)
    expect(mine.entries.map((e) => e.kind)).toEqual(['release', 'payment', 'adjustment'])
    expect(mine.entries[0]?.orderNumber).toBe(1)
    expect(mine.entries[0]).not.toHaveProperty('reason')
  })

  it('gives held credit back when staff cancel an order before it is paid', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 50_000)
    const cartId = await makeCart(storeId, variantId)
    const r = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: new FakePaymentProvider(),
          checkout: checkoutAs(EMAIL),
          storeCredit: { customerId },
        },
      ),
    )
    expect(await balanceOf(customerId)).toBe(0)
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    expect(await balanceOf(customerId)).toBe(50_000)
  })

  it('takes nothing without a signed-in customer, and never another customer’s credit', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 100_000)

    // A guest (no `storeCredit`) pays everything through the gateway.
    const cartId = await makeCart(storeId, variantId)
    const r = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: new FakePaymentProvider(),
          checkout: checkoutAs('guest@example.com'),
        },
      ),
    )
    expect(await creditPayments(r.orderId)).toEqual([])
    expect(await balanceOf(customerId)).toBe(100_000)

    // The order belongs to another email: the credit is refused and nothing is placed.
    const other = await makeCart(storeId, variantId)
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder(
          { storeId, tx },
          {
            cartId: other,
            paymentProvider: new FakePaymentProvider(),
            checkout: checkoutAs('someone-else@example.com'),
            storeCredit: { customerId },
          },
        ),
      ),
    ).rejects.toBeInstanceOf(StoreCreditError)
    expect(await balanceOf(customerId)).toBe(100_000)
  })

  it('refuses cash on delivery for what store credit leaves, and takes nothing', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 100_000)
    const cartId = await makeCart(storeId, variantId)
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder(
          { storeId, tx },
          {
            cartId,
            paymentProvider: new FakePaymentProvider({ mode: 'capture', id: 'cod' }),
            checkout: checkoutAs(EMAIL),
            storeCredit: { customerId },
          },
        ),
      ),
    ).rejects.toBeInstanceOf(StoreCreditError)
    expect(await balanceOf(customerId)).toBe(100_000)
  })

  it('is a payment, not a discount: the total, taxable value and GST stay the same', async () => {
    const { storeId, variantId, customerId } = await seedStore()
    await giveCredit(storeId, customerId, 200_000)
    const place = (cartId: string, withCredit: boolean) =>
      withStore(app, storeId, (tx) =>
        placeOrder(
          { storeId, tx },
          {
            cartId,
            paymentProvider: new FakePaymentProvider(),
            checkout: checkoutAs(EMAIL),
            ...(withCredit ? { storeCredit: { customerId } } : {}),
          },
        ),
      )
    const plain = await place(await makeCart(storeId, variantId), false)
    const credited = await place(await makeCart(storeId, variantId), true)
    const [a] = await owner.select().from(order).where(eq(order.id, plain.orderId))
    const [b] = await owner.select().from(order).where(eq(order.id, credited.orderId))
    expect(b?.totalPaise).toBe(a?.totalPaise)
    expect(b?.subtotalPaise).toBe(a?.subtotalPaise)
    expect(b?.discountPaise).toBe(a?.discountPaise)
    expect(b?.taxPaise).toBe(a?.taxPaise)
    expect(b?.taxBreakdown).toEqual(a?.taxBreakdown)
    expect(a?.taxPaise).toBeGreaterThan(0)
    expect((await creditPayments(credited.orderId))[0]?.amountPaise).toBe(200_000)
  })
})
