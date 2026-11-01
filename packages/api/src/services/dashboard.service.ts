import {
  notSystemTest,
  notTestOrder,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  parseAppsSettings,
  StoreAddressSchema,
  storeLowStockThreshold,
  UNPAID_PAYMENT_STATUSES,
} from '@commerce/core'
import { startOfMonth, wallClock } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
  inventoryAdjustment,
  media,
  order,
  orderLine,
  preorderCampaign,
  product,
  productMedia,
  returnRequest,
  sellableStock,
  store,
  variant,
} from '@commerce/db'
import { GST_INVOICES_ID, invoice, queuedInvoiceDrafts } from '@commerce/plugin-gst-invoices/server'
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql, sum } from 'drizzle-orm'
import type { LiveVisitors, VisitorSource } from '../context'
import { istIsoDate } from './analytics-buckets'
import {
  buildSeries,
  dayIndex,
  hourlyCounts,
  isoDate,
  istHour,
  istWeekday,
  paymentMethodLabel,
  startOfDay,
  statusBucket,
  zeros,
} from './dashboard-buckets'
import { type OrderStatus, viewFilter } from './order.service'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 7
/**
 * Drafts are not orders yet, and test-mode orders (gateway test keys) moved no real money:
 * neither counts towards revenue, tiles or the recent list.
 */
const notDraft = and(ne(order.status, 'draft'), notTestOrder)

const RECENT_ORDERS = 7
const TOP_PRODUCTS = 5
const LOW_STOCK_ROWS = 6
const HOURS = 24
const STATE_ROWS = 5
/** How many days of order history the payment mix, status mix and hours heatmap read. */
const MIX_WINDOW_DAYS = 30
const LIVE_MINUTES = 30
const CATEGORY_ROWS = 3
const LATEST_PRODUCTS = 3
/** How many orders the Live view globe plots as markers/arcs. A bit more than the 24h default's
 * 40 so the 7-day range still shows a reasonable spread. */
const MAP_ORDERS = 200

/** The Live view globe's "Time range" setting, and how far back each one looks. */
export type GlobeMapRange = '1h' | '24h' | '7d'
const MAP_RANGE_MS: Record<GlobeMapRange, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
}

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
    paymentStatus: OrderPaymentStatus
    fulfillmentStatus: OrderFulfillmentStatus
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
  /** Today, in IST: for the "Good evening" briefing sentence and its sparkline. */
  today: {
    ordersCount: number
    salesPaise: number
    /** Today's orders that are paid but not yet fulfilled. */
    toShipCount: number
    /** Orders per hour so far today, IST, midnight first, one entry per hour up to and including now. */
    hourly: number[]
    /** Storefront visitors (sessions) today, IST, from the beacon; 0 without a visitor source. */
    visitors: number
  }
  /** Yesterday's full 24 hours, IST, same shape as `today.hourly`, for the briefing sparkline's comparison line. */
  yesterday: {
    hourly: number[]
    /** Storefront visitors (sessions) yesterday, IST; 0 without a visitor source. */
    visitors: number
  }
  /**
   * The "Needs you" inbox: one row per actionable queue, each with a count and
   * a deep link. `null` means the queue has no data source yet (a hook, not
   * a zero) or the app it belongs to is not installed.
   */
  needsYou: {
    /** `oldestAt`: when the longest-waiting one was placed (Home's "Waiting 3 days"). */
    ordersToShip: { count: number; href: string; oldestAt: Date | null }
    upiToVerify: { count: number; href: string }
    gstQueued: { count: number; href: string } | null
    lowStock: { count: number; href: string }
    preorderBalanceDue: { count: number; href: string }
    /** Open orders still owed money (the Unpaid tab: COD, pending gateway or bank payments). */
    unpaid: { count: number; href: string }
    /** Active pre-order campaigns whose ship date falls in the next 7 days. */
    preorderShipSoon: { count: number; href: string }
    /** Return requests waiting for the merchant to approve or reject (the Requested tab). */
    returnsToReview: { count: number; href: string }
    failedDeliveries: { count: number; href: string } | null
  }
  /** Plain-language insight ingredients; the component turns these into sentences. */
  insight: {
    /** Change in this window's sales vs the window before, as a fraction (0.18 = +18%). Null when the prior window sold nothing. */
    salesChange: number | null
    bestSeller: { title: string; units: number } | null
  }
  /** This month, in IST: for the sales-goal ring. */
  month: {
    toDatePaise: number
    dayOfMonth: number
    daysInMonth: number
    /** Straight-line projection: `toDatePaise / dayOfMonth * daysInMonth`. */
    projectedPaise: number
    /** Best single calendar day of revenue in the last 90 days. */
    bestDayPaise: number
    bestDay: string | null
    /** Consecutive days up to today (IST) with at least one paid order, capped at 14 (the lookback window). */
    streakDays: number
    /** Last full calendar month's total, for suggesting a sensible default sales goal. */
    lastMonthSalesPaise: number
  }
  /** Orders with a shipping address over the Live view globe's "Time range" setting (`mapRange`,
   * 24h by default), newest first. */
  mapOrders: {
    id: string
    number: number
    city: string
    stateCode: string
    totalPaise: number
    placedAt: Date
  }[]
  /** The store's dispatch location (Settings > General address), for the globe's arc origin. Null when no address is set. */
  dispatch: { city: string; state: string } | null
  /** How the last 30 days of orders were paid for, by plain-language method label, busiest first. */
  paymentMix: { label: string; count: number }[]
  /** Where the last 30 days of orders sit right now, in a fixed owner-facing order. */
  statusMix: { status: 'to_ship' | 'shipped' | 'delivered' | 'cancelled'; count: number }[]
  /** Orders by weekday (0 = Sunday, IST) x hour (0-23, IST) over the last 30 days, for the "when do people buy" heatmap. */
  hoursHeatmap: number[][]
}

export type DashboardChartRange = 7 | 30 | 90

export type DashboardChartsData = {
  range: DashboardChartRange
  /** ISO dates (YYYY-MM-DD) in IST, oldest first, one entry per day of `range`. */
  days: string[]
  salesPaise: number[]
  orders: number[]
  /** Same shape as `salesPaise`, for the range immediately before; `null` when there is no order history that far back. */
  previousSalesPaise: number[] | null
  /** Storefront visitors (sessions) per day, same shape as `orders`; zeros without a visitor source. */
  visitors: number[]
  /** Visitors per day for the range immediately before, same shape. */
  previousVisitors: number[]
  topProducts: {
    productId: string
    title: string
    imageUrl: string | null
    units: number
    revenuePaise: number
  }[]
}

/**
 * Everything the admin home shows, in one round of queries. Windows are
 * "last 7 days" vs the 7 before, matching the kit's stat cards. Cancelled
 * orders are excluded from money and counts except the cancelled tile itself.
 */
export async function dashboardSummary(
  tx: StoreTx,
  opts: {
    storeId?: string
    visitors?: VisitorSource | undefined
    now?: Date
    mapRange?: GlobeMapRange
  } = {},
): Promise<DashboardSummary> {
  const now = opts.now ?? new Date()
  const lowStockThreshold = await storeLowStockThreshold(tx, opts.storeId)
  const thisStart = startOfDay(now, WINDOW_DAYS - 1)
  const lastStart = startOfDay(now, WINDOW_DAYS * 2 - 1)

  const recentRows = await tx
    .select({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
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
  /* Pending: open orders still waiting for their money (COD included). */
  const countPending = (rows: typeof recentRows) =>
    rows.filter((r) => r.status === 'open' && UNPAID_PAYMENT_STATUSES.includes(r.paymentStatus))
      .length

  const [customersRow] = await tx.select({ n: count() }).from(customer)
  // The same count as the Products list's "All" (archived included): Home read 307, the list 309 (#61).
  const [productsRow] = await tx.select({ n: count() }).from(product).where(notSystemTest)
  const stockRows = await tx
    .select({
      variantId: sellableStock.variantId,
      available: sql<number>`${sellableStock.onHand} - ${sellableStock.reserved}`.mapWith(Number),
    })
    .from(sellableStock)
    .innerJoin(variant, eq(variant.id, sellableStock.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    // The same rule as Inventory's "Out of stock": live variants of products not archived (#72).
    .where(
      and(
        eq(variant.trackInventory, true),
        isNull(variant.archivedAt),
        ne(product.status, 'archived'),
      ),
    )
  const inStock = stockRows.filter((r) => r.available > 0).length
  const outOfStock = stockRows.length - inStock
  const newCustomers = await tx
    .select({ at: customer.createdAt })
    .from(customer)
    .where(gte(customer.createdAt, lastStart))
  const newProducts = await tx
    .select({ at: product.createdAt })
    .from(product)
    .where(and(gte(product.createdAt, lastStart), notSystemTest))
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
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
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
      available: sql<number>`${sellableStock.onHand} - ${sellableStock.reserved}`.mapWith(Number),
    })
    .from(sellableStock)
    .innerJoin(variant, eq(variant.id, sellableStock.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(variant.trackInventory, true),
        isNull(variant.archivedAt),
        ne(product.status, 'archived'),
        lt(sql`${sellableStock.onHand} - ${sellableStock.reserved}`, lowStockThreshold + 1),
      ),
    )
    .orderBy(asc(sql`${sellableStock.onHand} - ${sellableStock.reserved}`))
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
          inStock: sql<boolean>`bool_or(${variant.trackInventory} = false or coalesce(${sellableStock.onHand} - ${sellableStock.reserved}, 0) > 0)`,
        })
        .from(variant)
        .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
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
        notSystemTest,
        sql`${product.productType} is not null and ${product.productType} <> ''`,
      ),
    )
    .groupBy(product.productType)
    .orderBy(desc(count()))
    .limit(CATEGORY_ROWS)
  const latestRows = await tx
    .select({ productId: product.id, title: product.title })
    .from(product)
    .where(and(ne(product.status, 'archived'), notSystemTest))
    .orderBy(desc(product.createdAt))
    .limit(LATEST_PRODUCTS)
  const coverRows = typeRows.length
    ? await tx
        .select({ type: product.productType, productId: product.id })
        .from(product)
        .where(
          and(
            ne(product.status, 'archived'),
            notSystemTest,
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

  /* Today, in IST: the briefing sentence and its "N need shipping" count. */
  const todayStart = startOfDay(now, 0)
  /* Visitors today and yesterday (IST days), for the hero's Visitors and Conversion tiles. */
  const visitorDays = [istIsoDate(startOfDay(now, 1)), istIsoDate(todayStart)]
  const dailyVisitors =
    opts.visitors?.daily && opts.storeId
      ? await opts.visitors.daily(opts.storeId, visitorDays)
      : { perDay: [0, 0], total: 0 }
  const [visitorsYesterday = 0, visitorsToday = 0] = dailyVisitors.perDay
  const todayRows = live(recentRows).filter((r) => r.placedAt >= todayStart)
  // Same rule as the Unfulfilled list "Ship N orders" opens, so the counts match (COD included).
  const toShip = viewFilter('unfulfilled')
  const [toShipTodayRow] = await tx
    .select({ n: count() })
    .from(order)
    .where(and(toShip, gte(order.placedAt, todayStart)))

  /* Needs you: one count per queue, each with its deep link. */
  // "Waiting N days" skips orders held for a pre-order line that has not shipped yet: they are
  // waiting on stock, not on the merchant.
  const [ordersToShipRow] = await tx
    .select({
      n: count(),
      oldestAt: sql<Date | null>`min(${order.placedAt}) filter (where not exists (
        select 1 from order_line ol where ol.order_id = "order".id and ol.preorder
        and (ol.preorder_ship_date is null or ol.preorder_ship_date > now())))`,
    })
    .from(order)
    .where(toShip)
  const [upiToVerifyRow] = await tx
    .select({ n: count() })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        eq(order.paymentMethod, 'manual'),
        isNull(order.importedFrom),
      ),
    )
  // "Restock N products" counts products (one with three sold-out sizes is one), not variants,
  // and skips archived variants: it read 1,219 on a store of 307 products (audit #2).
  const [lowStockCountRow] = await tx
    .select({ n: sql<number>`count(distinct ${product.id})`.mapWith(Number) })
    .from(sellableStock)
    .innerJoin(variant, eq(variant.id, sellableStock.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(variant.trackInventory, true),
        isNull(variant.archivedAt),
        ne(product.status, 'archived'),
        lt(sql`${sellableStock.onHand} - ${sellableStock.reserved}`, lowStockThreshold + 1),
      ),
    )
  const [preorderBalanceDueRow] = await tx
    .select({ n: count() })
    .from(order)
    .where(and(viewFilter('balance_due'), ne(order.status, 'draft')))
  const [unpaidRow] = await tx.select({ n: count() }).from(order).where(viewFilter('unpaid'))
  const [preorderShipSoonRow] = await tx
    .select({ n: count() })
    .from(preorderCampaign)
    .where(
      and(
        eq(preorderCampaign.status, 'active'),
        gte(preorderCampaign.shipDate, now),
        lt(preorderCampaign.shipDate, new Date(now.getTime() + 7 * DAY_MS)),
      ),
    )
  const [returnsToReviewRow] = await tx
    .select({ n: count() })
    .from(returnRequest)
    .where(eq(returnRequest.status, 'requested'))
  let gstQueued: { count: number; href: string } | null = null
  let dispatch: DashboardSummary['dispatch'] = null
  if (opts.storeId) {
    const [storeRow] = await tx
      .select({ apps: store.apps, address: store.address })
      .from(store)
      .where(eq(store.id, opts.storeId))
    if (parseAppsSettings(storeRow?.apps).installed.includes(GST_INVOICES_ID)) {
      const [queuedRow] = await tx.select({ n: count() }).from(invoice).where(queuedInvoiceDrafts())
      gstQueued = { count: queuedRow?.n ?? 0, href: '/apps/gst-invoices' }
    }
    const storeAddress = StoreAddressSchema.safeParse(storeRow?.address ?? {})
    if (storeAddress.success && storeAddress.data.city) {
      dispatch = { city: storeAddress.data.city, state: storeAddress.data.state }
    }
  }

  /* Plain-language insight ingredients: the 7-day sales trend and this week's best seller. */
  const prevSalesPaise = sumPaise(live(prev))
  const salesChange =
    prevSalesPaise > 0 ? (sumPaise(live(cur)) - prevSalesPaise) / prevSalesPaise : null
  const bestSeller = topRows[0] ? { title: topRows[0].title, units: topRows[0].units } : null

  /* This month, in IST: sales-goal ring and a streak line. */
  const shifted = wallClock(now)
  const dayOfMonth = shifted.getUTCDate()
  const daysInMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const monthStart = startOfMonth(now)
  const ninetyDaysAgo = startOfDay(now, 89)
  const revenueRows = await tx
    .select({ placedAt: order.placedAt, totalPaise: order.totalPaise })
    .from(order)
    .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, ninetyDaysAgo)))
  // From the whole month (revenueRows reach back 90 days), not the 14-day window above:
  // from the 15th that window no longer held the month's first days.
  const monthToDatePaise = revenueRows
    .filter((r) => r.placedAt >= monthStart)
    .reduce((n, r) => n + r.totalPaise, 0)
  const projectedPaise =
    dayOfMonth > 0 ? Math.round((monthToDatePaise / dayOfMonth) * daysInMonth) : 0
  const byDay = new Map<string, number>()
  for (const r of revenueRows)
    byDay.set(isoDate(r.placedAt), (byDay.get(isoDate(r.placedAt)) ?? 0) + r.totalPaise)
  let bestDayPaise = 0
  let bestDay: string | null = null
  for (const [day, paise] of byDay) {
    if (paise > bestDayPaise) {
      bestDayPaise = paise
      bestDay = day
    }
  }
  let streakDays = 0
  for (let i = 0; i < WINDOW_DAYS * 2; i++) {
    const day = isoDate(new Date(todayStart.getTime() - i * DAY_MS))
    if ((byDay.get(day) ?? 0) > 0) streakDays++
    else break
  }
  const lastMonthStart = startOfMonth(now, undefined, -1)
  const lastMonthSalesPaise = revenueRows
    .filter((r) => r.placedAt >= lastMonthStart && r.placedAt < monthStart)
    .reduce((n, r) => n + r.totalPaise, 0)

  /* Orders with a shipping address over the globe's chosen time range, for its markers/arcs. */
  const mapFrom = new Date(now.getTime() - MAP_RANGE_MS[opts.mapRange ?? '24h'])
  const mapOrderRows = await tx
    .select({
      id: order.id,
      number: order.number,
      city: address.city,
      stateCode: address.stateCode,
      totalPaise: order.totalPaise,
      placedAt: order.placedAt,
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, mapFrom)))
    .orderBy(desc(order.placedAt))
    .limit(MAP_ORDERS)

  /* Payment mix, status mix and the hours heatmap: one extra 30-day query, reused for all three. */
  const mixRows = await tx
    .select({
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentMethod: order.paymentMethod,
      placedAt: order.placedAt,
    })
    .from(order)
    .where(and(notDraft, gte(order.placedAt, startOfDay(now, MIX_WINDOW_DAYS - 1))))
  const liveMixRows = mixRows.filter((r) => r.status !== 'cancelled')

  const paymentCounts = new Map<string, number>()
  for (const r of liveMixRows) {
    const label = paymentMethodLabel(r.paymentMethod)
    paymentCounts.set(label, (paymentCounts.get(label) ?? 0) + 1)
  }
  const paymentMix = [...paymentCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const statusCounts = new Map<string, number>()
  for (const r of mixRows) {
    const bucket = statusBucket(r)
    if (bucket) statusCounts.set(bucket, (statusCounts.get(bucket) ?? 0) + 1)
  }
  const statusMix = (['to_ship', 'shipped', 'delivered', 'cancelled'] as const).map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }))

  const hoursHeatmap: number[][] = Array.from({ length: 7 }, () => zeros(HOURS))
  for (const r of liveMixRows) {
    const row = hoursHeatmap[istWeekday(r.placedAt)]
    if (!row) continue
    const h = istHour(r.placedAt)
    row[h] = (row[h] ?? 0) + 1
  }

  /* Today vs yesterday, hour by hour (IST), for the briefing sparkline. */
  const yesterdayStart = startOfDay(now, 1)
  const todayHourly = hourlyCounts(live(recentRows), todayStart, now)
  const yesterdayHourly = hourlyCounts(live(recentRows), yesterdayStart, todayStart)

  return {
    sales: { value: sumPaise(live(cur)), previous: sumPaise(live(prev)) },
    orders: { value: live(cur).length, previous: live(prev).length },
    pending: { value: countPending(cur), previous: countPending(prev) },
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
    today: {
      ordersCount: todayRows.length,
      salesPaise: sumPaise(todayRows),
      toShipCount: toShipTodayRow?.n ?? 0,
      hourly: todayHourly,
      visitors: visitorsToday,
    },
    yesterday: { hourly: yesterdayHourly, visitors: visitorsYesterday },
    needsYou: {
      ordersToShip: {
        count: ordersToShipRow?.n ?? 0,
        href: '/orders?status=unfulfilled',
        oldestAt: ordersToShipRow?.oldestAt ? new Date(ordersToShipRow.oldestAt) : null,
      },
      upiToVerify: { count: upiToVerifyRow?.n ?? 0, href: '/orders?status=pending_upi' },
      gstQueued,
      lowStock: { count: lowStockCountRow?.n ?? 0, href: '/stock/inventory' },
      preorderBalanceDue: {
        count: preorderBalanceDueRow?.n ?? 0,
        href: '/orders?status=balance_due',
      },
      unpaid: { count: unpaidRow?.n ?? 0, href: '/orders?status=unpaid' },
      preorderShipSoon: { count: preorderShipSoonRow?.n ?? 0, href: '/products/preorders' },
      returnsToReview: {
        count: returnsToReviewRow?.n ?? 0,
        href: '/orders/returns?status=requested',
      },
      failedDeliveries: null,
    },
    insight: { salesChange, bestSeller },
    month: {
      toDatePaise: monthToDatePaise,
      dayOfMonth,
      daysInMonth,
      projectedPaise,
      bestDayPaise,
      bestDay,
      streakDays,
      lastMonthSalesPaise,
    },
    mapOrders: mapOrderRows,
    dispatch,
    paymentMix,
    statusMix,
    hoursHeatmap,
  }
}

/**
 * The range-switch chart data for the home page: sales and order counts for `range`
 * days against the same span before it, plus the top 5 products by revenue in that
 * range. Separate from `dashboardSummary` so switching the range only refetches this.
 */
export async function dashboardCharts(
  tx: StoreTx,
  opts: {
    storeId?: string
    now?: Date
    range?: DashboardChartRange
    visitors?: VisitorSource | undefined
  } = {},
): Promise<DashboardChartsData> {
  const now = opts.now ?? new Date()
  const range = opts.range ?? 30
  const from = startOfDay(now, range - 1)
  const prevFrom = startOfDay(now, range * 2 - 1)

  const rows = await tx
    .select({ status: order.status, totalPaise: order.totalPaise, placedAt: order.placedAt })
    .from(order)
    .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, prevFrom)))

  const days = Array.from({ length: range }, (_, i) =>
    isoDate(new Date(from.getTime() + i * DAY_MS)),
  )
  const previousDays = Array.from({ length: range }, (_, i) =>
    isoDate(new Date(prevFrom.getTime() + i * DAY_MS)),
  )
  const visitorDaily =
    opts.visitors?.daily && opts.storeId
      ? await opts.visitors.daily(opts.storeId, [...previousDays, ...days])
      : { perDay: zeros(range * 2), total: 0 }
  const previousVisitors = visitorDaily.perDay.slice(0, range)
  const visitors = visitorDaily.perDay.slice(range)
  const salesPaise = zeros(range)
  const orders = zeros(range)
  const previousSalesPaise = zeros(range)
  let hasPrevious = false
  for (const r of rows) {
    const curIdx = dayIndex(r.placedAt, from, range)
    if (curIdx >= 0) {
      salesPaise[curIdx] = (salesPaise[curIdx] ?? 0) + r.totalPaise
      orders[curIdx] = (orders[curIdx] ?? 0) + 1
      continue
    }
    const prevIdx = dayIndex(r.placedAt, prevFrom, range)
    if (prevIdx >= 0) {
      hasPrevious = true
      previousSalesPaise[prevIdx] = (previousSalesPaise[prevIdx] ?? 0) + r.totalPaise
    }
  }

  const revenueExpr = sql<number>`sum(${orderLine.quantity} * ${orderLine.unitPricePaise})`
  const topRows = await tx
    .select({
      productId: variant.productId,
      title: product.title,
      units: sum(orderLine.quantity).mapWith(Number),
      revenuePaise: revenueExpr.mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, from)))
    .groupBy(variant.productId, product.title)
    .orderBy(desc(revenueExpr))
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

  return {
    range,
    days,
    salesPaise,
    orders,
    previousSalesPaise: hasPrevious ? previousSalesPaise : null,
    visitors,
    previousVisitors,
    topProducts: topRows.map((r) => ({ ...r, imageUrl: firstImage.get(r.productId) ?? null })),
  }
}
