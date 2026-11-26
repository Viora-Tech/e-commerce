import { createDb, newId, order, orderLine, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { analyticsSummary, demandByVariant, percentChange, previousPeriod } from '../src/analytics'
import { backInStockSignup } from '../src/schema'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY = 86_400_000

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId: s.id, title: 'Pad', handle: `pad-${slug}` })
  const variantId = newId()
  await owner
    .insert(variant)
    .values({ id: variantId, storeId: s.id, productId, title: 'Red', pricePaise: 100000 })
  return { storeId: s.id, productId, variantId }
}

function signup(storeId: string, productId: string, variantId: string, extra: object) {
  return {
    storeId,
    productId,
    variantId,
    unsubscribeToken: newId(),
    ...extra,
  }
}

describe('back in stock analytics', () => {
  it('counts waiting, new, notified and orders placed after an alert', async () => {
    const { storeId, productId, variantId } = await seed()
    const now = Date.now()
    const notifiedAt = new Date(now - 2 * DAY)
    await owner.insert(backInStockSignup).values([
      signup(storeId, productId, variantId, { email: 'a@x.in', status: 'confirmed' }),
      signup(storeId, productId, variantId, {
        email: 'b@x.in',
        status: 'pending_confirmation',
        createdAt: new Date(now - 40 * DAY),
      }),
      signup(storeId, productId, variantId, {
        email: 'c@x.in',
        status: 'notified',
        notifiedAt,
        createdAt: new Date(now - 5 * DAY),
      }),
    ])
    const orderId = newId()
    await owner.insert(order).values({
      id: orderId,
      storeId,
      number: 1001,
      status: 'open',
      email: 'C@x.in',
      subtotalPaise: 100000,
      totalPaise: 100000,
      placedAt: new Date(now - DAY),
    })
    await owner.insert(orderLine).values({
      storeId,
      orderId,
      variantId,
      title: 'Pad',
      quantity: 1,
      unitPricePaise: 100000,
    })

    const period = { from: new Date(now - 30 * DAY), to: new Date(now + 1000) }
    const summary = await withStore(app, storeId, (tx) => analyticsSummary(tx, storeId, period))
    expect(summary.waiting).toBe(2)
    expect(summary.current).toEqual({
      newSignups: 2,
      notified: 1,
      orders: 1,
      revenuePaise: 100000,
    })
    expect(summary.previous.newSignups).toBe(1)

    const rows = await withStore(app, storeId, (tx) => demandByVariant(tx, storeId, period))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ waiting: 2, newSignups: 2, notified: 1 })
    expect(rows[0]?.waitingSince?.getTime()).toBeLessThan(now - 30 * DAY)
  })

  it('compares with the period of the same length just before', () => {
    const p = { from: new Date(10 * DAY), to: new Date(17 * DAY) }
    expect(previousPeriod(p)).toEqual({ from: new Date(3 * DAY), to: new Date(10 * DAY) })
    expect(percentChange(15, 10)).toBe(50)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(3, 0)).toBeNull()
  })
})
