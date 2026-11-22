/** SOURCE OF TRUTH: refund safety tests — WHAT: refunds never return more than was captured (partials added up, per order and per payment), a repeated or retried refund moves money once, store credit vs the original payment, a store credit + UPI order sends credit back as credit and only the cash part to the gateway, and unpaid, failed or released payments cannot be refunded / WHY: replaces the manual "Refund safety (Razorpay test mode)" check (22 Nov 2026); the gateway is always a double */
import { createDb, customer, order, payment, refund, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { RefundContext } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { changeStoreCredit } from '../customers/store-credit'
import {
  captureHeldStoreCredit,
  releaseHeldStoreCredit,
  spendStoreCreditOnOrder,
} from '../customers/store-credit-checkout'
import { spendableStoreCredit } from '../customers/store-credit-expiry'
import { FakePaymentProvider } from '../providers/payment'
import { RefundNotAllowed, refundPayment } from './refund'
import { refundOptions, refundOrderAmount } from './refund-routes'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-0123456789abcdef0123456789abcdef'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/**
 * Razorpay without the network: like the real adapter (`payments-razorpay/src/refunds.ts`) a
 * second call with a refund key it has seen returns the refund already made, so `moved` is the
 * money that actually left. Optionally slow, so two unguarded refunds would overlap.
 */
class RazorpayDouble extends FakePaymentProvider {
  readonly keys: (string | undefined)[] = []
  private readonly made = new Map<string, { id: string; amountPaise: number }>()
  moved = 0
  failNext = false
  constructor(private readonly delayMs = 0) {
    super({ mode: 'capture', id: 'razorpay' })
  }
  override async refund(
    providerPaymentId: string,
    amountPaise: number,
    _note?: string,
    context?: RefundContext,
  ) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs))
    if (this.failNext) {
      this.failNext = false
      throw new Error('razorpay: refund declined')
    }
    const key = context?.refundKey
    this.keys.push(key)
    const earlier = key ? this.made.get(key) : undefined
    if (earlier) return { providerRefundId: earlier.id, status: 'processed' as const }
    const r = await super.refund(providerPaymentId, amountPaise)
    const id = `${r.providerRefundId}_${this.made.size + 1}`
    if (key) this.made.set(key, { id, amountPaise })
    this.moved += amountPaise
    return { providerRefundId: id, status: 'processed' as const }
  }
}

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

type PayStatus = 'captured' | 'pending' | 'authorized' | 'failed' | 'cancelled' | 'refunded'

/** An order for ₹1,000 by a signed-in customer, with optional ₹400 store credit to spend. */
async function seedOrder(opts: { credit?: number } = {}) {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1001,
      status: 'open',
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      email: 'asha@example.com',
      customerId: cu?.id ?? null,
    })
    .returning()
  if (!cu || !o) throw new Error('seed')
  const storeId = s.id
  if (opts.credit) {
    await inStore(storeId, (tx) =>
      changeStoreCredit(
        { storeId, tx },
        {
          customerId: cu.id,
          amountPaise: opts.credit as number,
          kind: 'adjustment',
          reason: 'Goodwill',
        },
      ),
    )
  }
  return { storeId, customerId: cu.id, orderId: o.id }
}

async function addRazorpay(
  storeId: string,
  orderId: string,
  amountPaise: number,
  status: PayStatus = 'captured',
) {
  const [p] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId,
      provider: 'razorpay',
      providerRef: 'order_rzp_1',
      providerPaymentId: status === 'captured' || status === 'refunded' ? 'pay_rzp_1' : null,
      status,
      amountPaise,
    })
    .returning()
  if (!p) throw new Error('seed')
  return p.id
}

/** ₹400 store credit + ₹600 UPI on Razorpay, both captured, as checkout leaves them. */
async function seedSplit() {
  const seeded = await seedOrder({ credit: 40_000 })
  const { storeId, customerId, orderId } = seeded
  await inStore(storeId, (tx) =>
    spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 100_000 }),
  )
  const razorpayId = await addRazorpay(storeId, orderId, 60_000)
  await inStore(storeId, (tx) => captureHeldStoreCredit({ storeId, tx }, orderId))
  const [credit] = await owner.select().from(payment).where(eq(payment.provider, 'store_credit'))
  if (credit?.status !== 'captured' || credit.amountPaise !== 40_000) throw new Error('seed')
  return { ...seeded, razorpayId, creditId: credit.id }
}

const balance = (storeId: string, customerId: string) =>
  inStore(storeId, (tx) => spendableStoreCredit({ storeId, tx }, customerId))

async function refundedOn(paymentId: string) {
  const rows = await owner.select().from(refund).where(eq(refund.paymentId, paymentId))
  return rows.reduce((sum, r) => sum + r.amountPaise, 0)
}

describe('refund total never exceeds what was captured', () => {
  it('partial refunds add up to the capture and not one paisa more', async () => {
    const { storeId, orderId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble()
    for (const amountPaise of [30_000, 30_000, 39_999]) {
      await inStore(storeId, (tx) => refundPayment({ tx, storeId }, gw, { paymentId, amountPaise }))
    }
    await expect(
      inStore(storeId, (tx) => refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 2 })),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 1 }),
    )
    await expect(
      inStore(storeId, (tx) => refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 1 })),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    expect(gw.moved).toBe(100_000)
    expect(await refundedOn(paymentId)).toBe(100_000)
    const [p] = await owner.select().from(payment).where(eq(payment.id, paymentId))
    expect(p?.status).toBe('refunded')
  })

  it('refunds recorded by hand and to store credit count against the same capture', async () => {
    const { storeId, orderId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble()
    await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, {
        paymentId,
        amountPaise: 50_000,
        manual: true,
        method: 'upi',
      }),
    )
    await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, null, {
        paymentId,
        amountPaise: 30_000,
        method: 'store_credit',
        secret: SECRET,
      }),
    )
    await expect(
      inStore(storeId, (tx) =>
        refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 20_001 }),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    expect(gw.moved).toBe(0)
  })

  it('an order-level refund is capped at what is left across all its payments', async () => {
    const { storeId, razorpayId, creditId, orderId } = await seedSplit()
    const providers = [new RazorpayDouble()]
    const run = (amountPaise: number) =>
      inStore(storeId, (tx) =>
        refundOrderAmount(
          { tx, storeId },
          {
            orderId,
            amountPaise,
            route: 'original',
            reason: 'Damaged',
            providers,
          },
        ),
      )
    await run(70_000)
    await expect(run(30_001)).rejects.toBeInstanceOf(RefundNotAllowed)
    await run(30_000)
    await expect(run(1)).rejects.toBeInstanceOf(RefundNotAllowed)
    expect((await refundedOn(razorpayId)) + (await refundedOn(creditId))).toBe(100_000)
    expect(providers[0]?.moved).toBe(60_000)
  })
})

describe('a repeated refund moves money once', () => {
  it('a double-clicked full refund: the second request is refused, the gateway is asked once', async () => {
    const { storeId, orderId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble(50)
    const once = () =>
      inStore(storeId, (tx) =>
        refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 100_000 }),
      )
    const results = await Promise.allSettled([once(), once(), once()])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    for (const r of results.filter((x) => x.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(RefundNotAllowed)
    }
    expect(gw.moved).toBe(100_000)
    expect(await refundedOn(paymentId)).toBe(100_000)
  })

  it('parallel order-level refunds on a split order cannot both go through', async () => {
    const { storeId, orderId, razorpayId, creditId, customerId } = await seedSplit()
    const providers = [new RazorpayDouble(50)]
    const once = () =>
      inStore(storeId, (tx) =>
        refundOrderAmount(
          { tx, storeId },
          {
            orderId,
            amountPaise: 100_000,
            route: 'original',
            reason: 'Cancelled',
            providers,
          },
        ),
      )
    const results = await Promise.allSettled([once(), once()])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(providers[0]?.moved).toBe(60_000)
    expect(await refundedOn(razorpayId)).toBe(60_000)
    expect(await refundedOn(creditId)).toBe(40_000)
    expect(await balance(storeId, customerId)).toBe(40_000)
  })

  it('a retry after the transaction failed reuses the refund key, so Razorpay refunds once', async () => {
    const { storeId, orderId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble()
    // The gateway refunded, then something later in the transaction threw: nothing recorded.
    await expect(
      inStore(storeId, async (tx) => {
        await refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 40_000 })
        throw new Error('commit lost')
      }),
    ).rejects.toThrow('commit lost')
    expect(await refundedOn(paymentId)).toBe(0)
    await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 40_000 }),
    )
    expect(gw.keys).toHaveLength(2)
    expect(gw.keys[0]).toBeTruthy()
    expect(gw.keys[1]).toBe(gw.keys[0])
    expect(gw.moved).toBe(40_000)
    // A later, separate partial refund gets a new key and is a new refund.
    await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 40_000 }),
    )
    expect(gw.keys[2]).not.toBe(gw.keys[0])
    expect(gw.moved).toBe(80_000)
  })

  it('a refund the gateway declines records nothing and leaves the full amount refundable', async () => {
    const { storeId, orderId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble()
    gw.failNext = true
    await expect(
      inStore(storeId, (tx) =>
        refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 100_000 }),
      ),
    ).rejects.toThrow('declined')
    expect(await refundedOn(paymentId)).toBe(0)
    await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 100_000 }),
    )
    expect(gw.moved).toBe(100_000)
  })
})

describe('store credit or the original payment', () => {
  it('to store credit: the balance goes up, Razorpay is never asked', async () => {
    const { storeId, orderId, customerId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble()
    const row = await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, {
        paymentId,
        amountPaise: 25_000,
        method: 'store_credit',
        secret: SECRET,
      }),
    )
    expect(row?.method).toBe('store_credit')
    expect(row?.status).toBe('manual')
    expect(gw.calls).toEqual([])
    expect(await balance(storeId, customerId)).toBe(25_000)
  })

  it('to the original payment: Razorpay is asked, no store credit is given', async () => {
    const { storeId, orderId, customerId } = await seedOrder()
    const paymentId = await addRazorpay(storeId, orderId, 100_000)
    const gw = new RazorpayDouble()
    const row = await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 25_000 }),
    )
    expect(row?.status).toBe('processed')
    expect(row?.method).toBeNull()
    expect(gw.calls).toEqual(['refund:pay_rzp_1:25000'])
    expect(await balance(storeId, customerId)).toBe(0)
  })
})

describe('store credit + UPI order', () => {
  it('a full original refund: credit goes back as credit, only the UPI part to Razorpay', async () => {
    const { storeId, orderId, customerId, razorpayId, creditId } = await seedSplit()
    expect(await balance(storeId, customerId)).toBe(0)
    const providers = [new RazorpayDouble()]
    await inStore(storeId, (tx) =>
      refundOrderAmount(
        { tx, storeId },
        {
          orderId,
          amountPaise: 100_000,
          route: 'original',
          reason: 'Cancelled',
          providers,
        },
      ),
    )
    expect(providers[0]?.calls).toEqual(['refund:pay_rzp_1:60000'])
    expect(await refundedOn(razorpayId)).toBe(60_000)
    expect(await refundedOn(creditId)).toBe(40_000)
    expect(await balance(storeId, customerId)).toBe(40_000)
  })

  it('a partial refund takes the UPI money first; the credit is touched only after', async () => {
    const { storeId, orderId, customerId } = await seedSplit()
    const providers = [new RazorpayDouble()]
    await inStore(storeId, (tx) =>
      refundOrderAmount(
        { tx, storeId },
        {
          orderId,
          amountPaise: 50_000,
          route: 'original',
          reason: 'One item back',
          providers,
        },
      ),
    )
    expect(providers[0]?.moved).toBe(50_000)
    expect(await balance(storeId, customerId)).toBe(0)
    const left = await inStore(storeId, (tx) => refundOptions({ tx, storeId }, orderId, providers))
    expect(left.refundablePaise).toBe(50_000)
  })

  it('refunded all to store credit: no gateway call, the whole order comes back as credit', async () => {
    const { storeId, orderId, customerId } = await seedSplit()
    const providers = [new RazorpayDouble()]
    await inStore(storeId, (tx) =>
      refundOrderAmount(
        { tx, storeId },
        {
          orderId,
          amountPaise: 100_000,
          route: 'store_credit',
          reason: 'Cancelled',
          providers,
          storeCredit: { secret: SECRET, createdBy: 'staff@example.com' },
        },
      ),
    )
    expect(providers[0]?.calls).toEqual([])
    expect(await balance(storeId, customerId)).toBe(100_000)
  })

  it('the store credit payment always goes back onto the balance, even when asked for UPI', async () => {
    const { storeId, customerId, creditId } = await seedSplit()
    const gw = new RazorpayDouble()
    const row = await inStore(storeId, (tx) =>
      refundPayment({ tx, storeId }, gw, {
        paymentId: creditId,
        amountPaise: 40_000,
        manual: true,
        method: 'upi',
      }),
    )
    expect(row?.method).toBe('store_credit')
    expect(gw.calls).toEqual([])
    expect(await balance(storeId, customerId)).toBe(40_000)
  })
})

describe('only captured money can be refunded', () => {
  for (const status of ['pending', 'authorized', 'failed', 'cancelled'] as const) {
    it(`a ${status} payment is refused and nothing moves`, async () => {
      const { storeId, orderId } = await seedOrder()
      const paymentId = await addRazorpay(storeId, orderId, 100_000, status)
      const gw = new RazorpayDouble()
      await expect(
        inStore(storeId, (tx) =>
          refundPayment({ tx, storeId }, gw, { paymentId, amountPaise: 1_000 }),
        ),
      ).rejects.toBeInstanceOf(RefundNotAllowed)
      expect(gw.calls).toEqual([])
      expect(await refundedOn(paymentId)).toBe(0)
    })
  }

  it('an order whose payment failed has nothing refundable at order level', async () => {
    const { storeId, orderId } = await seedOrder()
    await addRazorpay(storeId, orderId, 100_000, 'failed')
    const providers = [new RazorpayDouble()]
    const opts = await inStore(storeId, (tx) => refundOptions({ tx, storeId }, orderId, providers))
    expect(opts.refundablePaise).toBe(0)
    await expect(
      inStore(storeId, (tx) =>
        refundOrderAmount(
          { tx, storeId },
          {
            orderId,
            amountPaise: 1_000,
            route: 'original',
            reason: 'x',
            providers,
          },
        ),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    expect(providers[0]?.calls).toEqual([])
  })

  it('store credit held for an unpaid order and released on cancel cannot be refunded again', async () => {
    const { storeId, customerId, orderId } = await seedOrder({ credit: 40_000 })
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 100_000 }),
    )
    await inStore(storeId, (tx) => releaseHeldStoreCredit({ storeId, tx }, orderId))
    expect(await balance(storeId, customerId)).toBe(40_000)
    const [held] = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(held?.status).toBe('cancelled')
    await expect(
      inStore(storeId, (tx) =>
        refundPayment({ tx, storeId }, null, {
          paymentId: held?.id as string,
          amountPaise: 40_000,
        }),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    expect(await balance(storeId, customerId)).toBe(40_000)
  })
})
