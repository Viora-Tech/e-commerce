import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
  inventoryAdjustment,
  inventoryLevel,
  media,
  order,
  orderLine,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql, sum } from 'drizzle-orm'
import type { LiveVisitors, VisitorSource } from '../context'
import type { OrderStatus } from './order.service'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 7
/** Drafts are not orders yet: they never count towards revenue, tiles or the recent list. */
const notDraft = ne(order.status, 'draft')

const RECENT_ORDERS = 7
const TOP_PRODUCTS = 5
const LOW_STOCK_THRESHOLD = 5
const LOW_STOCK_ROWS = 6
const HOURS = 24
const STATE_ROWS = 3
const LIVE_MINUTES = 30
const CATEGORY_ROWS = 3
const LATEST_PRODUCTS = 3

export type DashboardWindow = {
  /** Current window value. */
  value: number
  /** Same metric for the window before. */
  previous: number
}

/** One value per day for the report chart, oldest first; every array has `days.length` entries. */
export type DashboardSeries = {
  /** ISO dates (YYYY-MM-DD) in Indian Standard Time. */
  days: string[]
  /** New customers created that day. */
  customers: number[]
  /** Products created that day. */
  products: number[]
  /** Tracked variants with stock at the end of that day. */
  inStock: number[]
  /** Tracked variants with no stock at the end of that day. */
  outOfStock: number[]
  /** Paid (non-cancelled) order totals placed that day. */
  revenuePaise: number[]
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
    thisWeek: DashboardSeries
    lastWeek: DashboardSeries
  }
  recentOrders: {
    id: string
    number: number
    status: OrderStatus
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
    imageUrl: string | null
  }[]
  /** Kit 5:1618: headline count plus one bar per hour, oldest first. */
  activity: {
    ordersLast24h: number
    perHour: number[]
  }
  /** Kit 5:1618 "Users in last 30 minutes": unique storefront visitors from the beacon. */
  liveVisitors: LiveVisitors
  /** Kit "Add New Product" panel: product types with counts and a cover, then the newest products. */
  categories: {
    type: string
    count: number
    imageUrl: string | null
  }[]
  latestProducts: {
    productId: string
    title: string
    pricePaise: number
    imageUrl: string | null
  }[]
  /** Kit "Sales by Country" with Indian states; share is of the 30-day total. */
  salesByState: {
    stateCode: string
    revenuePaise: number
    orders: number
    share: number
  }[]
}

const IST_OFFSET_MS = 5.5 * 3_600_000

/** Midnight `daysAgo` days before `now` in Indian Standard Time (fixed +05:30, no DST). */
function startOfDay(now: Date, daysAgo: number): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS)
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysAgo,
  )
  return new Date(utcMidnight - IST_OFFSET_MS)
}

/** ISO date of an instant, read in IST. */
function isoDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Day index of `at` counted from `from` (IST midnight), or -1 when outside `days`. */
function dayIndex(at: Date, from: Date, days: number): number {
  const idx = Math.floor((at.getTime() - from.getTime()) / DAY_MS)
  return idx >= 0 && idx < days ? idx : -1
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

/** Count `rows` into one bucket per day between `from` (inclusive) and `from + days`. */
function countByDay(rows: { at: Date; weight?: number }[], from: Date, days: number): number[] {
  const out = zeros(days)
  for (const r of rows) {
    const i = dayIndex(r.at, from, days)
    if (i >= 0) out[i] = (out[i] ?? 0) + (r.weight ?? 1)
  }
  return out
}

/**
 * End-of-day in-stock / out-of-stock counts for every day in the window, rebuilt
 * from today's levels by undoing the adjustment log backwards. A day with no
 * adjustments carries the next day's state, so the series never goes blank.
 */
function stockByDay(
  current: { variantId: string; available: number }[],
  adjustments: { variantId: string; delta: number; at: Date }[],
  from: Date,
  days: number,
): { inStock: number[]; outOfStock: number[] } {
  const deltaByDay = new Map<string, number[]>()
  for (const a of adjustments) {
    const i = dayIndex(a.at, from, days)
    if (i < 0) continue
    const arr = deltaByDay.get(a.variantId) ?? zeros(days)
    arr[i] = (arr[i] ?? 0) + a.delta
    deltaByDay.set(a.variantId, arr)
  }
  const inStock = zeros(days)
  const outOfStock = zeros(days)
  for (const v of current) {
    const deltas = deltaByDay.get(v.variantId)
    let available = v.available
    for (let d = days - 1; d >= 0; d--) {
      if (available > 0) inStock[d] = (inStock[d] ?? 0) + 1
      else outOfStock[d] = (outOfStock[d] ?? 0) + 1
      // Moving to the previous day's close means undoing everything logged on day `d`.
      available -= deltas?.[d] ?? 0
    }
  }
  return { inStock, outOfStock }
}

type SeriesInput = {
  orders: { placedAt: Date; totalPaise: number }[]
  customers: { at: Date }[]
  products: { at: Date }[]
  stock: { variantId: string; available: number }[]
  adjustments: { variantId: string; delta: number; at: Date }[]
}

/** One `DashboardSeries` for the `days` starting at `from` (IST midnight). */
function buildSeries(input: SeriesInput, from: Date, days: number): DashboardSeries {
  const dayList = Array.from({ length: days }, (_, i) =>
    isoDate(new Date(from.getTime() + i * DAY_MS)),
  )
  const revenuePaise = countByDay(
    input.orders.map((o) => ({ at: o.placedAt, weight: o.totalPaise })),
    from,
    days,
  )
  const { inStock, outOfStock } = stockByDay(input.stock, input.adjustments, from, days)
  return {
    days: dayList,
    customers: countByDay(input.customers, from, days),
    products: countByDay(input.products, from, days),
    inStock,
    outOfStock,
    revenuePaise,
  }
}

/**
 * Everything the admin home shows, in one round of queries. Windows are
 * "last 7 days" vs the 7 before, matching the kit's stat cards. Cancelled
 * orders are excluded from money and counts except the cancelled tile itself.
 */
export async function dashboardSummary(
  tx: StoreTx,
  opts: { storeId?: string; visitors?: VisitorSource | undefined; now?: Date } = {},
): Promise<DashboardSummary> {
  const now = opts.now ?? new Date()
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
    .where(and(notDraft, gte(order.placedAt, lastStart)))

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
      variantId: inventoryLevel.variantId,
      available: sql<number>`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`.mapWith(Number),
    })
    .from(inventoryLevel)
    .innerJoin(variant, eq(variant.id, inventoryLevel.variantId))
    .where(eq(variant.trackInventory, true))
  const inStock = stockRows.filter((r) => r.available > 0).length
  const outOfStock = stockRows.length - inStock
  const newCustomers = await tx
    .select({ at: customer.createdAt })
    .from(customer)
    .where(gte(customer.createdAt, lastStart))
  const newProducts = await tx
    .select({ at: product.createdAt })
    .from(product)
    .where(gte(product.createdAt, lastStart))
  const adjustments = await tx
    .select({
      variantId: inventoryAdjustment.variantId,
      delta: inventoryAdjustment.delta,
      at: inventoryAdjustment.createdAt,
    })
    .from(inventoryAdjustment)
    .where(gte(inventoryAdjustment.createdAt, lastStart))
  /* The stock series is rebuilt from today backwards across both weeks at once, then split. */
  const twoWeeks = buildSeries(
    {
      orders: live(inWindow(lastStart)),
      customers: newCustomers,
      products: newProducts,
      stock: stockRows,
      adjustments,
    },
    lastStart,
    WINDOW_DAYS * 2,
  )
  const sliceSeries = (from: number): DashboardSeries => ({
    days: twoWeeks.days.slice(from, from + WINDOW_DAYS),
    customers: twoWeeks.customers.slice(from, from + WINDOW_DAYS),
    products: twoWeeks.products.slice(from, from + WINDOW_DAYS),
    inStock: twoWeeks.inStock.slice(from, from + WINDOW_DAYS),
    outOfStock: twoWeeks.outOfStock.slice(from, from + WINDOW_DAYS),
    revenuePaise: twoWeeks.revenuePaise.slice(from, from + WINDOW_DAYS),
  })
  const [allTimeRevenue] = await tx
    .select({ total: sum(order.totalPaise).mapWith(Number) })
    .from(order)
    .where(and(notDraft, ne(order.status, 'cancelled')))

  const recentOrders = await tx
    .select({
      id: order.id,
      number: order.number,
      /* `notDraft` below guarantees the narrower type the dashboard exposes. */
      status: sql<OrderStatus>`${order.status}`,
      totalPaise: order.totalPaise,
      customerName: customer.name,
      email: order.email,
      placedAt: order.placedAt,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(notDraft)
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
    .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, startOfDay(now, 29))))
    .groupBy(variant.productId, product.title, product.handle)
    .orderBy(desc(sum(orderLine.quantity)))
    .limit(TOP_PRODUCTS)
  const topIds = topRows.map((r) => r.productId)
  const lowStockRows = await tx
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
  const imageIds = [...new Set([...topIds, ...lowStockRows.map((r) => r.productId)])]
  const images = imageIds.length
    ? await tx
        .select({
          productId: productMedia.productId,
          url: media.url,
          position: productMedia.position,
        })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(inArray(productMedia.productId, imageIds))
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

  const lowStock = lowStockRows.map((r) => ({
    ...r,
    imageUrl: firstImage.get(r.productId) ?? null,
  }))

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
    .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, startOfDay(now, 29))))
    .groupBy(address.stateCode)
    .orderBy(desc(sum(order.totalPaise)))
  const stateTotal = stateRows.reduce((n, r) => n + r.revenuePaise, 0)
  const salesByState = stateRows.slice(0, STATE_ROWS).map((r) => ({
    ...r,
    share: stateTotal > 0 ? r.revenuePaise / stateTotal : 0,
  }))

  const typeRows = await tx
    .select({ type: product.productType, n: count() })
    .from(product)
    .where(
      and(
        ne(product.status, 'archived'),
        sql`${product.productType} is not null and ${product.productType} <> ''`,
      ),
    )
    .groupBy(product.productType)
    .orderBy(desc(count()))
    .limit(CATEGORY_ROWS)
  const latestRows = await tx
    .select({ productId: product.id, title: product.title })
    .from(product)
    .where(ne(product.status, 'archived'))
    .orderBy(desc(product.createdAt))
    .limit(LATEST_PRODUCTS)
  const coverRows = typeRows.length
    ? await tx
        .select({ type: product.productType, productId: product.id })
        .from(product)
        .where(
          and(
            ne(product.status, 'archived'),
            inArray(
              product.productType,
              typeRows.map((r) => r.type ?? ''),
            ),
          ),
        )
        .orderBy(desc(product.createdAt))
    : []
  const coverByType = new Map<string, string>()
  for (const r of coverRows)
    if (r.type && !coverByType.has(r.type)) coverByType.set(r.type, r.productId)
  const extraIds = [
    ...new Set([...latestRows.map((r) => r.productId), ...coverByType.values()]),
  ].filter((id) => !firstImage.has(id))
  const extraImages = extraIds.length
    ? await tx
        .select({ productId: productMedia.productId, url: media.url })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(inArray(productMedia.productId, extraIds))
        .orderBy(asc(productMedia.position))
    : []
  for (const img of extraImages)
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url)
  const latestPrices = latestRows.length
    ? await tx
        .select({
          productId: variant.productId,
          pricePaise: sql<number>`min(${variant.pricePaise})`.mapWith(Number),
        })
        .from(variant)
        .where(
          inArray(
            variant.productId,
            latestRows.map((r) => r.productId),
          ),
        )
        .groupBy(variant.productId)
    : []
  const priceByProduct = new Map(latestPrices.map((r) => [r.productId, r.pricePaise]))

  const liveVisitors =
    opts.visitors && opts.storeId
      ? await opts.visitors.live(opts.storeId)
      : { last30: 0, perMinute: Array.from({ length: LIVE_MINUTES }, () => 0) }

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
      thisWeek: sliceSeries(WINDOW_DAYS),
      lastWeek: sliceSeries(0),
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
    liveVisitors,
    categories: typeRows.map((r) => ({
      type: r.type ?? '',
      count: r.n,
      imageUrl: (r.type && firstImage.get(coverByType.get(r.type) ?? '')) || null,
    })),
    latestProducts: latestRows.map((r) => ({
      ...r,
      pricePaise: priceByProduct.get(r.productId) ?? 0,
      imageUrl: firstImage.get(r.productId) ?? null,
    })),
    salesByState,
  }
}

export const DASHBOARD_LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD
