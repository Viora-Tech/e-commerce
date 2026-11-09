/**
 * Home and Analytics now total their orders in SQL (grouped by day and hour) instead of loading
 * every order into JavaScript. These tests seed a year of mixed orders (cancelled, drafts, test
 * orders, unfinished checkouts, imported ones, refunds, abandoned carts, stock changes) and check
 * that every figure equals what the old JavaScript versions computed (kept, unchanged, in
 * `support/legacy/`), at a few different moments (mid-month, just after an IST midnight, the
 * first of a month).
 */
import { createDb, type StoreTx, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { analyticsOverview } from '../src/services/analytics.service'
import { dashboardCharts, dashboardSummary } from '../src/services/dashboard.service'
import { homeAnalytics } from '../src/services/home-analytics.service'
import { analyticsOverview as legacyAnalyticsOverview } from './support/legacy/analytics.service'
import {
  dashboardCharts as legacyDashboardCharts,
  dashboardSummary as legacyDashboardSummary,
} from './support/legacy/dashboard.service'
import { homeAnalytics as legacyHomeAnalytics } from './support/legacy/home-analytics.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const DAY = 86_400_000

/** Mid-month evening, 00:20 IST (just after midnight), and 1 Nov in IST. */
const MOMENTS = [
  new Date('2026-11-18T14:47:23.456Z'),
  new Date('2026-11-09T18:50:00.000Z'),
  new Date('2026-10-31T19:00:00.000Z'),
]
/** The seed's "now": orders reach up to a day after the latest moment, so some are "future". */
const SEED_NOW = new Date('2026-11-19T12:00:00.000Z').getTime()

let storeId = ''

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

async function seed() {
  const sql = owner.$client
  const r = rng(424242)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T
  const id = () => crypto.randomUUID()
  const at = (msAgo: number) => new Date(SEED_NOW - msAgo)
  // Microseconds matter: the old code compared JS Dates (milliseconds), the new one SQL timestamps.
  const micro = (d: Date) =>
    `${d.toISOString().slice(0, 23)}${Math.floor(r() * 1000)
      .toString()
      .padStart(3, '0')}Z`

  storeId = id()
  await sql`insert into store ${sql({ id: storeId, slug: 'parity', name: 'Parity' })}`
  const locationId = id()
  await sql`insert into location ${sql({ id: locationId, store_id: storeId, name: 'Warehouse' })}`

  const types = ['Mouse pad', 'Keyboard', 'Mouse', '', null] as const
  const products: { id: string; variants: { id: string; price: number }[] }[] = []
  const productRows = []
  const variantRows = []
  const levelRows = []
  const mediaRows = []
  const productMediaRows = []
  for (let p = 0; p < 30; p++) {
    const pid = id()
    productRows.push({
      id: pid,
      store_id: storeId,
      handle: `p-${p}`,
      title: `Product ${p}`,
      product_type: pick(types),
      status: p % 9 === 0 ? 'archived' : 'active',
      created_at: at(p * 0.7 * DAY + p * 1000).toISOString(),
    })
    const variants = []
    for (let v = 0; v < 2; v++) {
      const vid = id()
      const price = 50_000 + Math.floor(r() * 400) * 100
      variants.push({ id: vid, price })
      variantRows.push({
        id: vid,
        store_id: storeId,
        product_id: pid,
        title: `V${v}`,
        price_paise: price,
        track_inventory: v === 0 || p % 4 !== 0,
        archived_at: p % 13 === 0 && v === 1 ? at(DAY).toISOString() : null,
      })
      levelRows.push({
        id: id(),
        store_id: storeId,
        variant_id: vid,
        location_id: locationId,
        on_hand: Math.floor(r() * 8),
        reserved: Math.floor(r() * 2),
      })
    }
    products.push({ id: pid, variants })
    for (let m = 0; m < 2; m++) {
      if (p % 3 === 2) continue
      const mid = id()
      mediaRows.push({ id: mid, store_id: storeId, url: `https://cdn.test/p${p}-${m}.jpg` })
      productMediaRows.push({
        id: id(),
        store_id: storeId,
        product_id: pid,
        media_id: mid,
        position: 1 - m,
      })
    }
  }
  await sql`insert into product ${sql(productRows)}`
  await sql`insert into variant ${sql(variantRows)}`
  await sql`insert into inventory_level ${sql(levelRows)}`
  await sql`insert into media ${sql(mediaRows)}`
  await sql`insert into product_media ${sql(productMediaRows)}`
  const allVariants = products.flatMap((p) => p.variants)
  await sql`insert into inventory_adjustment ${sql(
    Array.from({ length: 120 }, () => ({
      id: id(),
      store_id: storeId,
      variant_id: pick(allVariants).id,
      delta: Math.floor(r() * 7) - 3,
      reason: 'correction',
      created_at: micro(at(r() * 20 * DAY)),
    })),
  )}`

  const customers = Array.from({ length: 60 }, (_, i) => ({
    id: id(),
    store_id: storeId,
    email: `c${i}@example.in`,
    name: `Customer ${i}`,
    created_at: micro(at(r() * 30 * DAY)),
  }))
  await sql`insert into customer ${sql(customers)}`

  const states = ['MH', 'KA', 'TN', 'DL', 'GJ'] as const
  const statuses = ['open', 'open', 'completed', 'completed', 'cancelled', 'draft'] as const
  const payStatuses = [
    'paid',
    'paid',
    'unpaid',
    'partially_paid',
    'authorized',
    'refunded',
  ] as const
  const fulfil = [
    'unfulfilled',
    'fulfilled',
    'shipped',
    'delivered',
    'partially_fulfilled',
    'partially_delivered',
    'returned',
  ] as const
  const methods = ['razorpay', 'razorpay', 'cod', 'manual', 'gift_card', null] as const
  const gateways = ['UPI Id', 'Cards, UPI by Razorpay', 'Cash on Delivery (COD)', 'bogus'] as const
  const addresses = []
  const orders = []
  const lines = []
  const payments = []
  for (let n = 0; n < 900; n++) {
    // Dense near "now" (Home's windows), thinner over the year (Analytics, year comparison).
    const ago = n < 500 ? r() * 40 * DAY - DAY : r() * 420 * DAY
    const placed = micro(at(ago))
    const imported = n % 17 === 0
    const status = pick(statuses)
    const addressId = id()
    addresses.push({
      id: addressId,
      store_id: storeId,
      name: 'Buyer',
      line1: '1 Road',
      city: 'City',
      state_code: pick(states),
      pincode: '400001',
      phone: '9876543210',
    })
    const orderId = id()
    const itemCount = 1 + Math.floor(r() * 3)
    let subtotal = 0
    for (let l = 0; l < itemCount; l++) {
      const v = pick(allVariants)
      const qty = 1 + Math.floor(r() * 3)
      subtotal += v.price * qty
      lines.push({
        id: id(),
        store_id: storeId,
        order_id: orderId,
        variant_id: v.id,
        title: 'Line',
        quantity: qty,
        unit_price_paise: v.price,
      })
    }
    const discountPaise = r() < 0.3 ? Math.floor(subtotal * 0.1) : 0
    const shippingPaise = r() < 0.5 ? 4900 : 0
    const taxPaise = r() < 0.7 ? Math.floor(subtotal * 0.18) : 0
    const total = subtotal - discountPaise + shippingPaise
    const method = imported && r() < 0.6 ? null : pick(methods)
    orders.push({
      id: orderId,
      store_id: storeId,
      number: n + 1,
      customer_id: r() < 0.85 ? pick(customers).id : null,
      email: 'buyer@example.in',
      shipping_address_id: addressId,
      status,
      payment_status: pick(payStatuses),
      fulfillment_status: pick(fulfil),
      payment_method: method,
      subtotal_paise: subtotal,
      discount_paise: discountPaise,
      shipping_paise: shippingPaise,
      tax_paise: taxPaise,
      total_paise: total,
      placed_at: placed,
      checkout_paid_at: r() < 0.6 ? placed : null,
      // An unfinished online checkout (cart, unpaid, gateway): not a sale.
      cart_id: n % 23 === 0 ? id() : null,
      is_test: n % 29 === 0,
      imported_from: imported ? 'shopify' : null,
      import_meta: imported ? JSON.stringify({ paymentMethod: pick(gateways) }) : null,
      attribution:
        r() < 0.4 ? JSON.stringify({ channel: pick(['direct', 'google', 'instagram']) }) : null,
      draft_number: status === 'draft' ? n + 1 : null,
    })
    payments.push({
      id: id(),
      store_id: storeId,
      order_id: orderId,
      provider: method ?? 'manual',
      provider_ref: `ref_${n}`,
      status: 'captured',
      amount_paise: total,
    })
  }
  await sql`insert into address ${sql(addresses)}`
  await sql`insert into "order" ${sql(orders)}`
  await sql`insert into order_line ${sql(lines)}`
  await sql`insert into payment ${sql(payments)}`
  await sql`insert into refund ${sql(
    payments.slice(0, 120).flatMap((p, i) =>
      i % 3 === 0
        ? [
            {
              id: id(),
              store_id: storeId,
              order_id: p.order_id,
              payment_id: p.id,
              amount_paise: Math.floor(p.amount_paise / 2),
              status: pick(['processed', 'manual', 'failed'] as const),
              created_at: micro(at(r() * 40 * DAY)),
            },
          ]
        : [],
    ),
  )}`
  const carts = Array.from({ length: 50 }, (_, i) => ({
    id: id(),
    store_id: storeId,
    email: i % 4 === 0 ? null : `cart${i}@example.in`,
    phone: i % 5 === 0 ? '9876543210' : null,
    status: i % 6 === 0 ? 'converted' : 'open',
    created_at: micro(at(r() * 40 * DAY + DAY)),
    updated_at: micro(at(r() * 40 * DAY)),
  }))
  await sql`insert into cart ${sql(carts)}`
  await sql`insert into cart_line ${sql(
    carts
      .filter((_, i) => i % 7 !== 0)
      .map((c) => ({
        id: id(),
        store_id: storeId,
        cart_id: c.id,
        variant_id: pick(allVariants).id,
        quantity: 1,
        unit_price_paise: 10_000,
      })),
  )}`
  await sql`insert into marketing_session ${sql(
    Array.from({ length: 400 }, (_, i) => ({
      id: id(),
      store_id: storeId,
      visitor_id: `v${i % 150}`,
      channel: 'direct',
      started_at: micro(at(r() * 60 * DAY)),
    })),
  )}`
}

/** Arrays whose order between equal counts was never defined: compare them as sets. */
function normalise<T>(value: T): T {
  const v = structuredClone(value) as Record<string, unknown>
  for (const key of ['paymentMix', 'paymentMethods']) {
    const list = v[key] as { label?: string; method?: string }[] | undefined
    list?.sort((a, b) => String(a.label ?? a.method).localeCompare(String(b.label ?? b.method)))
  }
  return v as T
}

const run = <T>(fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

beforeAll(async () => {
  await resetDb(owner)
  await seed()
}, 60_000)
afterEach(() => {
  vi.useRealTimers()
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe.each(MOMENTS.map((now) => [now.toISOString(), now] as const))('at %s', (_, now) => {
  it('dashboard.summary matches the old JS totals', async () => {
    const [next, old] = await Promise.all([
      run((tx) => dashboardSummary(tx, { storeId, now })),
      run((tx) => legacyDashboardSummary(tx, { storeId, now })),
    ])
    expect(next.orders.value + next.orders.previous).toBeGreaterThan(0)
    expect(normalise(next)).toEqual(normalise(old))
  })

  it.each([7, 30, 90] as const)('dashboard.charts (%i days) matches', async (range) => {
    const [next, old] = await Promise.all([
      run((tx) => dashboardCharts(tx, { storeId, now, range })),
      run((tx) => legacyDashboardCharts(tx, { storeId, now, range })),
    ])
    expect(next).toEqual(old)
  })

  const day = (offset: number) =>
    new Date(now.getTime() + 19_800_000 - offset * DAY).toISOString().slice(0, 10)
  it.each([
    ['today', 0, 'previous'],
    ['yesterday by hour', 1, 'year'],
    ['7 days', 6, 'previous'],
    ['30 days', 29, 'year'],
    ['a year', 365, 'previous'],
    ['90 days, no comparison', 89, 'none'],
  ] as const)('dashboard.analytics (%s) matches', async (_label, back, compare) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    const input = { from: day(back), to: back === 1 ? day(1) : day(0), compare, storeId }
    const [next, old] = await Promise.all([
      run((tx) => homeAnalytics(tx, input)),
      run((tx) => legacyHomeAnalytics(tx, input)),
    ])
    expect(next).toEqual(old)
  })

  it.each(['today', '7d', '30d', '90d'] as const)(
    'analytics overview (%s) matches',
    async (key) => {
      const [next, old] = await Promise.all([
        run((tx) => analyticsOverview(tx, { range: { key }, storeId, now })),
        run((tx) => legacyAnalyticsOverview(tx, { range: { key }, storeId, now })),
      ])
      expect(normalise(next)).toEqual(normalise(old))
    },
  )
})
