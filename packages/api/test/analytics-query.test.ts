/** SOURCE OF TRUTH: custom analytics query against the database — WHAT product filters, the whole history, filters by collection, state and HAVING, store isolation, injection attempts and the AI's analyticsQuery tool / WHY "how many TRIAINA have we sold" must be answerable by one query, never by a one-off tool */
import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  collection,
  collectionProduct,
  createDb,
  customer,
  newId,
  order,
  orderLine,
  product,
  returnRequest,
  returnRequestLine,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { queryTools } from '../src/services/ai/query-tool'
import { type CustomQueryResult, runCustomQuery } from '../src/services/analytics-query.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string }
}

type Merchant = Awaited<ReturnType<typeof merchant>>

async function seedProduct(
  storeId: string,
  p: { title: string; vendor?: string; tags?: string[] },
  variants: string[],
) {
  const productId = newId()
  await owner.insert(product).values({
    id: productId,
    storeId,
    title: p.title,
    vendor: p.vendor ?? null,
    tags: p.tags ?? [],
    handle: `p-${productId}`,
    status: 'active',
  })
  const ids: Record<string, string> = {}
  for (const [position, title] of variants.entries()) {
    const id = newId()
    ids[title] = id
    await owner.insert(variant).values({
      id,
      storeId,
      productId,
      title,
      pricePaise: 1000,
      sku: `${p.title}-${title}`,
      position,
    })
  }
  return { productId, variants: ids }
}

/** One order, placed at `placedAt`, with lines of (variant, quantity, unit price in paise). */
async function seedOrder(
  storeId: string,
  number: number,
  placedAt: string,
  lines: [string, number, number][],
  extra: Partial<typeof order.$inferInsert> & { state?: string; customerName?: string } = {},
) {
  const { state, customerName, ...rest } = extra
  const subtotal = lines.reduce((n, [, q, p]) => n + q * p, 0)
  let shippingAddressId: string | null = null
  if (state) {
    shippingAddressId = newId()
    await owner.insert(address).values({
      id: shippingAddressId,
      storeId,
      name: 'A',
      line1: '1 Road',
      city: 'Pune',
      stateCode: state,
      pincode: '411001',
      phone: '9000000000',
    })
  }
  let customerId: string | null = null
  if (customerName) {
    customerId = newId()
    await owner
      .insert(customer)
      .values({ id: customerId, storeId, name: customerName, email: `${customerId}@x.in` })
  }
  const id = newId()
  await owner.insert(order).values({
    id,
    storeId,
    number,
    status: 'open',
    subtotalPaise: subtotal,
    totalPaise: subtotal,
    placedAt: new Date(placedAt),
    shippingAddressId,
    customerId,
    paymentMethod: 'cod',
    ...rest,
  })
  for (const [variantId, quantity, unitPricePaise] of lines) {
    await owner
      .insert(orderLine)
      .values({ storeId, orderId: id, variantId, title: 'Line', quantity, unitPricePaise })
  }
  return id
}

const query = async (m: Merchant, source: string) => {
  const out = (await call(
    appRouter.analytics.query,
    { source },
    { context: m.ctx },
  )) as CustomQueryResult
  if (!out.ok) throw new Error(`${out.error.line}: ${out.error.message}`)
  return out
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** Waimers-like data: TRIAINA sold in 2021, 2025 and 2026, plus noise that must not count. */
async function seed() {
  const m = await merchant('query-owner@example.com', 'query-store')
  const triaina = await seedProduct(
    m.storeId,
    { title: 'Waizowl TRIAINA Wireless Gaming Mouse', vendor: 'Waizowl', tags: ['wireless'] },
    ['Black', 'White'],
  )
  const pad = await seedProduct(m.storeId, { title: 'Glasspad Pro', vendor: 'Glide' }, ['Default'])
  const mice = newId()
  await owner
    .insert(collection)
    .values({ id: mice, storeId: m.storeId, handle: 'mice', title: 'Mice' })
  await owner.insert(collectionProduct).values({
    storeId: m.storeId,
    collectionId: mice,
    productId: triaina.productId,
    position: 0,
  })
  const black = triaina.variants.Black as string
  const white = triaina.variants.White as string
  const glass = pad.variants.Default as string
  await seedOrder(m.storeId, 1, '2021-03-04T06:00:00Z', [[black, 2, 4999_00]], {
    state: 'MH',
    customerName: 'Asha Rao',
  })
  await seedOrder(
    m.storeId,
    2,
    '2025-06-01T06:00:00Z',
    [
      [white, 1, 4999_00],
      [glass, 3, 1500_00],
    ],
    { state: 'KA', customerName: 'Ravi Kumar' },
  )
  await seedOrder(m.storeId, 3, '2026-10-10T06:00:00Z', [[black, 4, 4499_00]], {
    state: 'MH',
    customerName: 'Asha Rao',
  })
  // Never counted: a cancelled order, a test-mode order and a draft.
  await seedOrder(m.storeId, 4, '2026-10-11T06:00:00Z', [[black, 9, 4999_00]], {
    status: 'cancelled',
  })
  await seedOrder(m.storeId, 5, '2026-10-12T06:00:00Z', [[black, 9, 4999_00]], { isTest: true })
  await seedOrder(m.storeId, -6, '2026-10-13T06:00:00Z', [[black, 9, 4999_00]], { status: 'draft' })
  // Another store's TRIAINA sales stay in that store.
  const other = await merchant('query-other@example.com', 'query-other')
  const theirs = await seedProduct(other.storeId, { title: 'Waizowl TRIAINA' }, ['Default'])
  await seedOrder(other.storeId, 1, '2026-10-10T06:00:00Z', [
    [theirs.variants.Default as string, 50, 100],
  ])
  return m
}

describe('custom analytics query (WHERE and full history)', () => {
  it('answers "how many TRIAINA have we sold, all time" from every year', async () => {
    const m = await seed()
    const out = await query(
      m,
      "FROM products\n  SHOW net_quantity, gross_sales, orders\n  WHERE product_title CONTAINS 'Waizowl TRIAINA'\n  DURING all_time",
    )
    expect(out.result.totals).toEqual({
      net_quantity: 7,
      gross_sales: 2 * 4999_00 + 4999_00 + 4 * 4499_00,
      orders: 3,
    })
    expect(out.days.from).toBe('2021-03-04')
    expect(out.result.range.from).toBe('2021-03-04')
    expect(out.query).toContain("WHERE product_title CONTAINS 'Waizowl TRIAINA'")
    // Lower case and one word of the title find the same product.
    const short = await query(
      m,
      "FROM products SHOW net_quantity WHERE product_title CONTAINS 'triaina' DURING all_time",
    )
    expect(short.result.totals.net_quantity).toBe(7)
  })

  it('keeps a multi-year SINCE / UNTIL whole instead of cutting it to a year', async () => {
    const m = await seed()
    const out = await query(
      m,
      "FROM products SHOW net_quantity WHERE product_title CONTAINS 'triaina' GROUP BY year SINCE 2021-01-01 UNTIL today ORDER BY year ASC",
    )
    expect(out.result.range.from).toBe('2021-01-01')
    expect(out.result.rows.map((r) => [r.values.year, r.values.net_quantity])).toEqual([
      ['2021', 2],
      ['2025', 1],
      ['2026', 4],
    ])
    const tooLong = (await call(
      appRouter.analytics.query,
      { source: 'FROM sales SHOW orders SINCE 2001-01-01 UNTIL today' },
      { context: m.ctx },
    )) as CustomQueryResult
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) expect(tooLong.error.message).toContain('20 years')
  })

  it('groups by product and variant, filters by collection, vendor, tag and state name', async () => {
    const m = await seed()
    const byVariant = await query(
      m,
      'FROM products SHOW net_quantity GROUP BY product_title, variant_title DURING all_time ORDER BY net_quantity DESC',
    )
    expect(byVariant.result.rows.map((r) => r.key)).toEqual([
      'Waizowl TRIAINA Wireless Gaming Mouse · Black',
      'Glasspad Pro · Default',
      'Waizowl TRIAINA Wireless Gaming Mouse · White',
    ])
    const inMice = await query(
      m,
      "FROM products SHOW net_quantity WHERE collection = 'mice' AND vendor IN ('waizowl', 'x') AND product_tag = 'WIRELESS' DURING all_time",
    )
    expect(inMice.result.totals.net_quantity).toBe(7)
    const notMice = await query(
      m,
      "FROM products SHOW net_quantity WHERE collection != 'Mice' DURING all_time",
    )
    expect(notMice.result.totals.net_quantity).toBe(3)
    const maharashtra = await query(
      m,
      "FROM sales SHOW orders, total_sales WHERE state = 'Maharashtra' DURING all_time",
    )
    expect(maharashtra.result.totals.orders).toBe(2)
    const withPad = await query(
      m,
      "FROM sales SHOW orders WHERE product_title CONTAINS 'glasspad' DURING all_time",
    )
    expect(withPad.result.totals.orders).toBe(1)
  })

  it('HAVING keeps customers with two or more orders; money compares in rupees', async () => {
    const m = await seed()
    const repeat = await query(
      m,
      'FROM sales SHOW orders, total_sales GROUP BY customer_name HAVING orders >= 2 DURING all_time',
    )
    expect(repeat.result.rows.map((r) => r.values.customer_name)).toEqual(['Asha Rao'])
    const big = await query(
      m,
      'FROM sales SHOW total_sales GROUP BY customer_name HAVING total_sales > 9000 DURING all_time ORDER BY total_sales DESC',
    )
    expect(big.result.rows.map((r) => r.values.customer_name)).toEqual(['Asha Rao', 'Ravi Kumar'])
  })

  it('treats SQL in a value as text and never as SQL', async () => {
    const m = await seed()
    const attempts = [
      "FROM products SHOW net_quantity WHERE product_title = 'x''; DELETE FROM \"order\"; --' DURING all_time",
      "FROM products SHOW net_quantity WHERE product_title CONTAINS '%' DURING all_time",
      "FROM products SHOW net_quantity WHERE vendor IN ('a'') OR 1=1 --') DURING all_time",
      "FROM products SHOW net_quantity WHERE product_title STARTS WITH '_' DURING all_time",
    ]
    for (const source of attempts) {
      const out = await query(m, source)
      expect(out.result.totals.net_quantity, source).toBe(0)
    }
    const refused = (await call(
      appRouter.analytics.query,
      { source: 'FROM products SHOW net_quantity WHERE 1=1 OR product_title = product_title' },
      { context: m.ctx },
    )) as CustomQueryResult
    expect(refused.ok).toBe(false)
    const [{ n }] = (await owner.execute(
      sql`select count(*)::int as n from "order"`,
    )) as unknown as [{ n: number }]
    expect(n).toBe(7)
  })

  it('net_quantity is ordered minus returned, on the order date; cancelled orders never count', async () => {
    const m = await seed()
    const kb = await seedProduct(m.storeId, { title: 'Kestrel Keyboard' }, ['Default'])
    const kv = kb.variants.Default as string
    const placed = await seedOrder(m.storeId, 10, '2026-09-05T06:00:00Z', [[kv, 3, 2000_00]])
    const cancelled = await seedOrder(m.storeId, 11, '2026-09-06T06:00:00Z', [[kv, 5, 2000_00]], {
      status: 'cancelled',
    })
    const lineOf = async (orderId: string) => {
      const [row] = await owner
        .select({ id: orderLine.id })
        .from(orderLine)
        .where(sql`${orderLine.orderId} = ${orderId}`)
      return row?.id as string
    }
    const addReturn = async (
      orderId: string,
      number: number,
      status: 'received' | 'rejected',
      quantity: number,
    ) => {
      const id = newId()
      await owner
        .insert(returnRequest)
        .values({ id, storeId: m.storeId, orderId, number, status, requestedAt: new Date() })
      await owner.insert(returnRequestLine).values({
        storeId: m.storeId,
        returnRequestId: id,
        orderLineId: await lineOf(orderId),
        quantity,
      })
    }
    // One unit came back (received in November, counted on the September order); a rejected
    // return and a return on the cancelled order change nothing.
    await addReturn(placed, 1, 'received', 1)
    await addReturn(placed, 2, 'rejected', 2)
    await addReturn(cancelled, 3, 'received', 5)

    const out = await query(
      m,
      "FROM products SHOW ordered_quantity, returned_quantity, net_quantity WHERE product_title CONTAINS 'kestrel' GROUP BY month DURING all_time",
    )
    expect(out.result.totals).toEqual({
      ordered_quantity: 3,
      returned_quantity: 1,
      net_quantity: 2,
    })
    expect(out.result.rows.map((r) => [r.values.month, r.values.net_quantity])).toEqual([
      ['2026-09', 2],
    ])
  })

  it('hides customer names from a role without customer access', async () => {
    const m = await seed()
    const out = await withStore(app, m.storeId, (tx) =>
      runCustomQuery(tx, 'FROM sales SHOW orders GROUP BY customer_name DURING all_time', {
        customerNames: 'hidden',
      }),
    )
    expect(out.ok).toBe(false)
  })

  it('the AI tool answers with the number, the dates and the query, first names only', async () => {
    const m = await seed()
    const tools = queryTools(
      {
        db: app,
        store: { name: 'Waimers', slug: 'query-store', currency: 'INR', timezone: 'Asia/Kolkata' },
        now: () => new Date('2026-11-15T04:30:00Z'),
      },
      { readCustomers: true },
    )
    const runtime = {
      storeId: m.storeId,
      userId: 'u',
      plan: 'starter' as const,
      feature: 'assistant' as const,
    }
    const sold = (await tools.analyticsQuery?.run(
      {
        query:
          "FROM products\n  SHOW net_quantity, gross_sales\n  WHERE product_title CONTAINS 'triaina'\n  DURING all_time",
      },
      runtime,
    )) as { facts: { label: string; value: string }[]; table: { query: string; rows: unknown[] } }
    const fact = (label: string) => sold.facts.find((f) => f.label === label)?.value
    expect(fact('Total net_quantity')).toBe('7')
    expect(fact('Total gross_sales')).toBe('₹32,993')
    expect(fact('Dates covered')).toBe(
      "2021-03-04 to 2026-11-15 (all time, from the store's first order)",
    )
    expect(sold.table.query).toContain("product_title CONTAINS 'triaina'")
    expect(sold.table.rows).toHaveLength(1)

    const names = (await tools.analyticsQuery?.run(
      { query: 'FROM sales SHOW orders GROUP BY customer_name DURING all_time' },
      runtime,
    )) as { facts: { label: string }[]; shared?: string[] }
    expect(names.facts.map((f) => f.label)).toContain('Asha')
    expect(JSON.stringify(names)).not.toContain('Rao')
    expect(names.shared).toEqual(['customer first names'])

    const broken = (await tools.analyticsQuery?.run(
      { query: "FROM products SHOW units WHERE product_title CONTAINS 'triaina'" },
      runtime,
    )) as { facts: { label: string; value: string }[] }
    expect(broken.facts[0]?.label).toBe('Query problem')
    expect(broken.facts[0]?.value).toContain('Unknown field')
  })
})
