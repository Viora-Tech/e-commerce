/** When the gateway took the money but recording its answer failed, the attempt is refunded with a stable key and always marked failed, even when that refund throws (#1791). */
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { RefundContext } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { placeOrder } from '../order/place-order'
import { startPaymentAttempt } from './attempts'
import { GatewayDouble } from './gateway-double.test-util'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A gateway that captures at creation and answers with a session the database cannot store. */
class CapturesUnrecordable extends GatewayDouble {
  readonly refunds: { ref: string; amountPaise: number; context?: RefundContext }[] = []
  refundFails = false
  override async createPayment() {
    return {
      providerRef: 'pay_taken',
      status: 'captured' as const,
      // JSON cannot hold a BigInt: writing the session fails, as a lost connection would.
      session: { kind: 'none' as const, big: 1n } as never,
    }
  }
  override async refund(ref: string, amountPaise: number, _note?: string, context?: RefundContext) {
    this.refunds.push({ ref, amountPaise, context })
    if (this.refundFails) throw new Error('gateway refund timeout')
    return { providerRefundId: 'rf_back', status: 'processed' as const }
  }
}

async function placedAttempt(gw: GatewayDouble) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'w' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId: s.id, cartId: c.id, variantId: v.id, quantity: 1, unitPricePaise: 10000 })
  const r = await withStore(app, s.id, (tx) =>
    placeOrder({ storeId: s.id, tx }, { cartId: c.id, paymentProvider: gw }),
  )
  if (!r.attemptId) throw new Error('no attempt')
  return { storeId: s.id, attemptId: r.attemptId }
}

const attempt = async (id: string) =>
  (await owner.select().from(payment).where(eq(payment.id, id)))[0]

describe('compensating refund when the answer cannot be recorded', () => {
  it('refunds the money taken with a stable refund key and marks the attempt failed', async () => {
    const gw = new CapturesUnrecordable()
    const { storeId, attemptId } = await placedAttempt(gw)
    const log = { error: vi.fn() }
    const r = await startPaymentAttempt(app, storeId, attemptId, gw, log)
    expect(r.status).toBe('failed')
    expect(gw.refunds).toHaveLength(1)
    expect(gw.refunds[0]).toMatchObject({ ref: 'pay_taken', amountPaise: 10000 })
    expect(gw.refunds[0]?.context?.refundKey).toMatch(/^rfc_[0-9a-f]{20}$/)
    expect((await attempt(attemptId))?.status).toBe('failed')
  })

  it('still marks the attempt failed when that refund throws, and says the money is owed', async () => {
    const gw = new CapturesUnrecordable()
    gw.refundFails = true
    const { storeId, attemptId } = await placedAttempt(gw)
    const log = { error: vi.fn() }
    const r = await startPaymentAttempt(app, storeId, attemptId, gw, log)
    expect(r.status).toBe('failed')
    const row = await attempt(attemptId)
    expect(row?.status).toBe('failed')
    expect(row?.error).toMatch(/pay_taken.*refund/i)
    expect(log.error).toHaveBeenCalledWith(
      expect.stringMatching(/compensating refund failed/),
      expect.objectContaining({ attemptId, providerRef: 'pay_taken', amountPaise: 10000 }),
    )
  })
})
