/** SOURCE OF TRUTH: every "units sold" is net of returns — WHAT Home and dashboard Top products, Analytics Top products, Home's best seller and units tile, the product page's "Sales past 90 days" and the restock best-seller card all count ordered minus returned (`NET_UNITS`) / WHY one product must show one units-sold number everywhere, the same as the custom query's net_quantity */
import { refreshHomeCards } from '@commerce/core'
import {
  createDb,
  homeCard,
  inventoryLevel,
  newId,
  order,
  orderLine,
  product,
  returnRequest,
  returnRequestLine,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { analyticsOverview } from '../src/services/analytics.service'
import { dashboardCharts, dashboardSummary } from '../src/services/dashboard.service'
import { homeAnalytics } from '../src/services/home-analytics.service'
import { productSales } from '../src/services/product-sales.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A store that sold 6 of one product a minute ago, with 2 of them returned (and 1 rejected). */
async function seed() {
  const storeId = newId()
  await owner.insert(store).values({ id: storeId, slug: 'net-units', name: 'Net units' })
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId, handle: 'kestrel', title: 'Kestrel', status: 'active' })
  const variantId = newId()
  await owner
    .insert(variant)
    .values({ id: variantId, storeId, productId, title: 'Default', pricePaise: 1000_00 })
  // Two left: low stock, so the restock card turns on once five or more sold.
  await owner.insert(inventoryLevel).values({ storeId, variantId, onHand: 2, reserved: 0 })
  const orderId = newId()
  await owner.insert(order).values({
    id: orderId,
    storeId,
    number: 1,
    status: 'open',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    subtotalPaise: 6000_00,
    totalPaise: 6000_00,
    placedAt: new Date(Date.now() - 60_000),
  })
  const [line] = await owner
    .insert(orderLine)
    .values({ storeId, orderId, variantId, title: 'Kestrel', quantity: 6, unitPricePaise: 1000_00 })
    .returning()
  const returns: string[] = []
  for (const [number, status, quantity] of [
    [1, 'received', 2],
    [2, 'rejected', 3],
  ] as const) {
    const id = newId()
    returns.push(id)
    await owner.insert(returnRequest).values({ id, storeId, orderId, number, status })
    await owner.insert(returnRequestLine).values({
      storeId,
      returnRequestId: id,
      orderLineId: line?.id as string,
      quantity,
    })
  }
  return { storeId, productId, returnId: returns[0] as string }
}

const run = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const istDay = (offset: number) =>
  new Date(Date.now() + 19_800_000 - offset * 86_400_000).toISOString().slice(0, 10)

beforeEach(async () => {
  await resetDb(owner)
})

describe('units sold are ordered minus returned', () => {
  it('on Home, the dashboard, Analytics and the product page', async () => {
    const { storeId, productId } = await seed()
    const now = new Date()

    const summary = await run(storeId, (tx) => dashboardSummary(tx, { storeId, now }))
    expect(summary.topProducts[0]).toMatchObject({ title: 'Kestrel', units: 4 })

    const charts = await run(storeId, (tx) => dashboardCharts(tx, { storeId, now, range: 30 }))
    expect(charts.topProducts[0]).toMatchObject({ title: 'Kestrel', units: 4 })

    const overview = await run(storeId, (tx) =>
      analyticsOverview(tx, { range: { key: '30d' }, storeId, now }),
    )
    // Gross sales stay what was ordered; only the units are net.
    expect(overview.topProducts[0]).toMatchObject({ units: 4, revenuePaise: 6000_00 })

    const home = await run(storeId, (tx) =>
      homeAnalytics(tx, { from: istDay(6), to: istDay(0), compare: 'none', storeId }),
    )
    expect(home.metrics.topProducts.value).toBe(4)
    expect(home.topProduct).toEqual({ title: 'Kestrel', units: 4 })

    const card = await run(storeId, (tx) => productSales(tx, productId, now))
    expect(card).toMatchObject({ units: 4, orders: 1, grossPaise: 6000_00 })
  })

  it('on the restock best-seller card', async () => {
    const { storeId, returnId } = await seed()
    const restock = async () => {
      await run(storeId, (tx) => refreshHomeCards({ storeId, tx }))
      const rows = await owner.select({ data: homeCard.data }).from(homeCard)
      return rows
        .map((r) => r.data as { kind: string; unitsSold?: number })
        .find((c) => c.kind === 'restock_bestseller')
    }
    // 6 ordered, 2 back: 4 sold is under the five that make a best seller.
    expect(await restock()).toBeUndefined()
    await owner
      .update(returnRequest)
      .set({ status: 'cancelled' })
      .where(eq(returnRequest.id, returnId))
    expect(await restock()).toMatchObject({ unitsSold: 6 })
  })
})
