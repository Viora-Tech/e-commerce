import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
  inventoryLevel,
  media,
  order,
  orderLine,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql, sum } from 'drizzle-orm'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 7
const RECENT_ORDERS = 5
const TOP_PRODUCTS = 5
const LOW_STOCK_THRESHOLD = 5
const LOW_STOCK_ROWS = 6
const HOURS = 24
const STATE_ROWS = 3

export type DashboardWindow = {
  /** Current window value. */
  value: number
  /** Same metric for the window before. */
  previous: number
}

export type DashboardDay = {
  /** ISO date (YYYY-MM-DD) in the server's timezone. */
  date: string
  revenuePaise: number
  orders: number
}

export type DashboardSummary = {
  sales: DashboardWindow
  orders: DashboardWindow
  pending: DashboardWindow
  cancelled: DashboardWindow
  report: {
    customers: number
    products: number
    inStock: number
    outOfStock: number
    revenuePaise: number
    thisWeek: DashboardDay[]
    lastWeek: DashboardDay[]
  }
  recentOrders: {
    id: string
    number: number
    status: 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'
    totalPaise: number
    customerName: string | null
    email: string | null
    placedAt: Date
  }[]
  topProducts: {
    productId: string
    title: string
    handle: string
    imageUrl: string | null
    units: number
    revenuePaise: number
    /** Lowest variant price, what the kit's "Price" column shows. */
    pricePaise: number
    /** False only when every tracked variant is at zero. */
    inStock: boolean
  }[]
  lowStock: {
    variantId: string
    productId: string
    title: string
    variantTitle: string
    available: number
  }[]
  /** Kit 5:1618: headline count plus one bar per hour, oldest first. */
  activity: {
    ordersLast24h: number
    perHour: number[]
  }
  /** Kit "Sales by Country" with Indian states; share is of the 30-day total. */
  salesByState: {
    stateCode: string
    revenuePaise: number
    orders: number
    share: number
  }[]
}

/** Midnight `daysAgo` days before `now`, local time. */
function startOfDay(now: Date, daysAgo: number): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Bucket orders into one entry per day between `from` (inclusive) and `to` (exclusive). */
function bucketByDay(
  rows: { placedAt: Date; totalPaise: number }[],
  from: Date,
  days: number,
): DashboardDay[] {
  const buckets: DashboardDay[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    return { date: isoDate(d), revenuePaise: 0, orders: 0 }
  })
  for (const r of rows) {
    const idx = Math.floor((r.placedAt.getTime() - from.getTime()) / DAY_MS)
    const b = buckets[idx]
    if (b) {
      b.revenuePaise += r.totalPaise
      b.orders += 1
    }
  }
  return buckets
}

/**
 * Everything the admin home shows, in one round of queries. Windows are
 * "last 7 days" vs the 7 before, matching the kit's stat cards. Cancelled
 * orders are excluded from money and counts except the cancelled tile itself.
 */
export async function dashboardSummary(tx: StoreTx, now = new Date()): Promise<DashboardSummary> {
  const thisStart = startOfDay(now, WINDOW_DAYS - 1)
  const lastStart = startOfDay(now, WINDOW_DAYS * 2 - 1)

  const recentRows = await tx
    .select({
      id: order.id,
      status: order.status,
      totalPaise: order.totalPaise,
      placedAt: order.placedAt,
    })
    .from(order)
    .where(gte(order.placedAt, lastStart))

  const inWindow = (from: Date, to?: Date) =>
    recentRows.filter((r) => r.placedAt >= from && (!to || r.placedAt < to))
  const cur = inWindow(thisStart)
  const prev = inWindow(lastStart, thisStart)
  const live = (rows: typeof recentRows) => rows.filter((r) => r.status !== 'cancelled')
  const sumPaise = (rows: typeof recentRows) => rows.reduce((n, r) => n + r.totalPaise, 0)
  const countStatus = (rows: typeof recentRows, s: string) =>
    rows.filter((r) => r.status === s).length

  const [customersRow] = await tx.select({ n: count() }).from(customer)
  const [productsRow] = await tx
    .select({ n: count() })
    .from(product)
    .where(ne(product.status, 'archived'))
  const stockRows = await tx
    .select({
      available: sql<number>`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`.mapWith(Number),
    })
    .from(inventoryLevel)
    .innerJoin(variant, eq(variant.id, inventoryLevel.variantId))
    .where(eq(variant.trackInventory, true))
  const inStock = stockRows.filter((r) => r.available > 0).length
  const outOfStock = stockRows.length - inStock
  const [allTimeRevenue] = await tx
    .select({ total: sum(order.totalPaise).mapWith(Number) })
    .from(order)
    .where(ne(order.status, 'cancelled'))

  const recentOrders = await tx
    .select({
      id: order.id,
      number: order.number,
      status: order.status,
      totalPaise: order.totalPaise,
      customerName: customer.name,
      email: order.email,
      placedAt: order.placedAt,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .orderBy(desc(order.placedAt))
    .limit(RECENT_ORDERS)

  const topRows = await tx
    .select({
      productId: variant.productId,
      title: product.title,
      handle: product.handle,
      units: sum(orderLine.quantity).mapWith(Number),
      revenuePaise: sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`).mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(ne(order.status, 'cancelled'), gte(order.placedAt, startOfDay(now, 29))))
    .groupBy(variant.productId, product.title, product.handle)
    .orderBy(desc(sum(orderLine.quantity)))
    .limit(TOP_PRODUCTS)
  const topIds = topRows.map((r) => r.productId)
  const images = topIds.length
    ? await tx
        .select({
          productId: productMedia.productId,
          url: media.url,
          position: productMedia.position,
        })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(inArray(productMedia.productId, topIds))
        .orderBy(asc(productMedia.position))
    : []
  const firstImage = new Map<string, string>()
  for (const img of images)
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url)
  const stockByProduct = topIds.length
    ? await tx
        .select({
          productId: variant.productId,
          pricePaise: sql<number>`min(${variant.pricePaise})`.mapWith(Number),
          inStock: sql<boolean>`bool_or(${variant.trackInventory} = false or coalesce(${inventoryLevel.onHand} - ${inventoryLevel.reserved}, 0) > 0)`,
        })
        .from(variant)
        .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
        .where(inArray(variant.productId, topIds))
        .groupBy(variant.productId)
    : []
  const stockInfo = new Map(stockByProduct.map((r) => [r.productId, r]))

  const lowStock = await tx
    .select({
      variantId: variant.id,
      productId: variant.productId,
      title: product.title,
      variantTitle: variant.title,
      available: sql<number>`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`.mapWith(Number),
    })
    .from(inventoryLevel)
    .innerJoin(variant, eq(variant.id, inventoryLevel.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(variant.trackInventory, true),
        ne(product.status, 'archived'),
        lt(sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`, LOW_STOCK_THRESHOLD + 1),
      ),
    )
    .orderBy(asc(sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`))
    .limit(LOW_STOCK_ROWS)

  const dayAgo = new Date(now.getTime() - HOURS * 3_600_000)
  const perHour = Array.from({ length: HOURS }, () => 0)
  for (const r of live(recentRows)) {
    if (r.placedAt < dayAgo) continue
    const idx = Math.min(
      HOURS - 1,
      Math.floor((r.placedAt.getTime() - dayAgo.getTime()) / 3_600_000),
    )
    perHour[idx] = (perHour[idx] ?? 0) + 1
  }

  const stateRows = await tx
    .select({
      stateCode: address.stateCode,
      revenuePaise: sum(order.totalPaise).mapWith(Number),
      orders: count(),
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(ne(order.status, 'cancelled'), gte(order.placedAt, startOfDay(now, 29))))
    .groupBy(address.stateCode)
    .orderBy(desc(sum(order.totalPaise)))
  const stateTotal = stateRows.reduce((n, r) => n + r.revenuePaise, 0)
  const salesByState = stateRows.slice(0, STATE_ROWS).map((r) => ({
    ...r,
    share: stateTotal > 0 ? r.revenuePaise / stateTotal : 0,
  }))

  return {
    sales: { value: sumPaise(live(cur)), previous: sumPaise(live(prev)) },
    orders: { value: live(cur).length, previous: live(prev).length },
    pending: { value: countStatus(cur, 'placed'), previous: countStatus(prev, 'placed') },
    cancelled: { value: countStatus(cur, 'cancelled'), previous: countStatus(prev, 'cancelled') },
    report: {
      customers: customersRow?.n ?? 0,
      products: productsRow?.n ?? 0,
      inStock,
      outOfStock,
      revenuePaise: allTimeRevenue?.total ?? 0,
      thisWeek: bucketByDay(live(cur), thisStart, WINDOW_DAYS),
      lastWeek: bucketByDay(live(prev), lastStart, WINDOW_DAYS),
    },
    recentOrders,
    topProducts: topRows.map((r) => ({
      ...r,
      imageUrl: firstImage.get(r.productId) ?? null,
      pricePaise: stockInfo.get(r.productId)?.pricePaise ?? 0,
      inStock: stockInfo.get(r.productId)?.inStock ?? true,
    })),
    lowStock,
    activity: { ordersLast24h: perHour.reduce((n, v) => n + v, 0), perHour },
    salesByState,
  }
}

export const DASHBOARD_LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD
