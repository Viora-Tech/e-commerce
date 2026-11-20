/** SOURCE OF TRUTH: store credit with cash on delivery and cancel tests — WHAT: part credit with COD is refused and leaves nothing behind, credit that covers a COD pick makes a prepaid order with no COD confirmation, and a cancel gives back the exact credit once however often it runs / WHY: the owner's live test (21 Nov 2026) adds credit, orders with COD and cancels; the balance must end where it started */
import {
  cart,
  cartLine,
  createDb,
  customer,
  inventoryLevel,
  order,
  outboxEvent,
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
import { COD_RTO_APP_ID } from '../cod-rto/settings'
import { placeOrder, placeOrderAndPay } from '../order/place-order'
import { RefundNotAllowed, refundPayment } from '../order/refund'
import { cancelOrderByStaff } from '../order/staff-cancel'
import { cancelOrder } from '../order/status'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { FakePaymentProvider } from '../providers/payment'
import { changeStoreCredit, StoreCreditError } from './store-credit'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const PRICE = 49_900
const EMAIL = 'tester@example.com'
const checkout = {
  name: 'Test Shopper',
  email: EMAIL,
  phone: '9999999999',
  address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
}
const cod = () => new FakePaymentProvider({ mode: 'capture', id: 'cod' })

/** A store with one ₹499 mouse and a customer; the COD & RTO app asks every COD order to confirm. */
async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      apps: {
        installed: [COD_RTO_APP_ID],
        settings: { [COD_RTO_APP_ID]: { verification: { enabled: true, sendTo: 'all' } } },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Black', pricePaise: PRICE })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: EMAIL, name: 'Test Shopper' })
    .returning()
  if (!cu) throw new Error('seed')
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId: s.id, cartId: c.id, variantId: v.id, quantity: 1, unitPricePaise: PRICE })
  return { storeId: s.id, customerId: cu.id, cartId: c.id }
}

const giveCredit = (storeId: string, customerId: string, amountPaise: number) =>
  withStore(app, storeId, (tx) =>
    changeStoreCredit(
      { storeId, tx },
      { customerId, amountPaise, kind: 'adjustment', reason: 'Saturday test' },
    ),
  )

async function balanceOf(customerId: string): Promise<number> {
  const [a] = await owner
    .select({ balancePaise: storeCreditAccount.balancePaise })
    .from(storeCreditAccount)
    .where(eq(storeCreditAccount.customerId, customerId))
  return a?.balancePaise ?? 0
}

const ledgerOf = (customerId: string) =>
  owner
    .select({ kind: storeCreditEntry.kind, amountPaise: storeCreditEntry.amountPaise })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.customerId, customerId))

const codConfirmEvents = () =>
  owner.select().from(outboxEvent).where(eq(outboxEvent.type, 'order.cod_confirm_requested'))

describe('store credit with cash on delivery', () => {
  it('refuses part credit with COD and leaves no order, payment or ledger line behind', async () => {
    const { storeId, customerId, cartId } = await seedStore()
    await giveCredit(storeId, customerId, 20_000)
    await expect(
      placeOrderAndPay(app, storeId, {
        cartId,
        paymentProvider: cod(),
        checkout,
        storeCredit: { customerId },
      }),
    ).rejects.toBeInstanceOf(StoreCreditError)
    expect(await balanceOf(customerId)).toBe(20_000)
    expect(await owner.select().from(order)).toEqual([])
    expect(await owner.select().from(payment)).toEqual([])
    expect((await ledgerOf(customerId)).map((l) => l.kind)).toEqual(['adjustment'])
    // The same cart with store credit off still places a COD order (and asks to confirm it).
    const r = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: cod(), checkout })
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o).toMatchObject({ paymentMethod: 'cod', codVerification: 'pending' })
    expect(await codConfirmEvents()).toHaveLength(1)
    expect(await balanceOf(customerId)).toBe(20_000)
  })

  it('credit that covers a COD pick makes a paid order with nothing to collect and no COD confirmation', async () => {
    const { storeId, customerId, cartId } = await seedStore()
    await giveCredit(storeId, customerId, 60_000)
    const provider = cod()
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: provider,
      checkout,
      storeCredit: { customerId },
    })
    expect(provider.calls).toEqual([])
    expect(r.attemptId).toBeNull()
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o).toMatchObject({
      paymentStatus: 'paid',
      paymentMethod: STORE_CREDIT_PROVIDER,
      totalPaise: PRICE,
      codVerification: null,
    })
    const pays = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pays.map((p) => [p.provider, p.status, p.amountPaise])).toEqual([
      [STORE_CREDIT_PROVIDER, 'captured', PRICE],
    ])
    expect(await codConfirmEvents()).toEqual([])
    expect(await balanceOf(customerId)).toBe(60_000 - PRICE)
  })
})

describe('cancel gives store credit back once', () => {
  it('a paid-by-credit order: exact amount back, one refund line, repeats and refunds change nothing', async () => {
    const { storeId, customerId, cartId } = await seedStore()
    await giveCredit(storeId, customerId, 60_000)
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: cod(),
      checkout,
      storeCredit: { customerId },
    })
    expect(await balanceOf(customerId)).toBe(60_000 - PRICE)

    const staffCancel = () =>
      withStore(app, storeId, (tx) =>
        cancelOrderByStaff(
          { storeId, tx },
          {
            orderId: r.orderId,
            reasonCode: 'customer',
            restock: true,
            notifyCustomer: false,
            refund: 'original',
            author: 'owner@example.com',
          },
          [],
        ),
      )
    const cancelled = await staffCancel()
    expect(cancelled.status).toBe('cancelled')
    expect(await balanceOf(customerId)).toBe(60_000)

    // Cancel again, from every path: nothing more comes back.
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    await expect(staffCancel()).rejects.toThrow()
    const [creditPay] = await owner
      .select()
      .from(payment)
      .where(and(eq(payment.orderId, r.orderId), eq(payment.provider, STORE_CREDIT_PROVIDER)))
    expect(creditPay?.status).toBe('refunded')
    await expect(
      withStore(app, storeId, (tx) =>
        refundPayment({ storeId, tx }, null, {
          paymentId: creditPay?.id as string,
          amountPaise: 100,
        }),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)

    expect(await balanceOf(customerId)).toBe(60_000)
    const ledger = await ledgerOf(customerId)
    expect(ledger.filter((l) => l.kind === 'payment').map((l) => l.amountPaise)).toEqual([-PRICE])
    expect(ledger.filter((l) => l.kind === 'refund').map((l) => l.amountPaise)).toEqual([PRICE])
    expect(ledger.reduce((sum, l) => sum + l.amountPaise, 0)).toBe(60_000)
  })

  it('a held part (online rest unpaid): two cancels at once release it once', async () => {
    const { storeId, customerId, cartId } = await seedStore()
    await giveCredit(storeId, customerId, 20_000)
    const r = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: new FakePaymentProvider(),
          checkout,
          storeCredit: { customerId },
        },
      ),
    )
    expect(await balanceOf(customerId)).toBe(0)
    await Promise.all(
      [1, 2].map(() => withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))),
    )
    await withStore(app, storeId, (tx) => cancelOrder({ storeId, tx }, r.orderId))
    expect(await balanceOf(customerId)).toBe(20_000)
    const ledger = await ledgerOf(customerId)
    expect(ledger.filter((l) => l.kind === 'release').map((l) => l.amountPaise)).toEqual([20_000])
    expect(ledger.filter((l) => l.kind === 'refund')).toEqual([])
  })
})
