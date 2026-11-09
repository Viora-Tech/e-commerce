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
import { isoDate, paymentMethodLabel, startOfDay, statusBucket, zeros } from './dashboard-buckets'
import { type OrderStatus, viewFilter } from './order.service'
import {
  countWhere,
  int,
  istDaySql,
  istHourSql,
  istWeekdaySql,
  stepIndex,
  sumInt,
  sumWhere,
  ts,
} from './sql-buckets'

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
 * Everything the admin home shows. Windows are "last 7 days" vs the 7 before, matching the
 * kit's stat cards. Cancelled orders are excluded from money and counts except the cancelled
 * tile itself.
 *
 * Totals are grouped in Postgres (by day, IST hour, window) and only those few rows come back;
 * the store's orders and variants never load into JavaScript. The independent reads go out
 * together on the request's transaction, so they share round trips.
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
  const lastStart = startOfDay(now, WINDOW_DAYS * 2 - 1)
  const todayStart = startOfDay(now, 0)
  const yesterdayStart = startOfDay(now, 1)
  const dayAgo = new Date(now.getTime() - HOURS * 3_600_000)
  const thirtyDaysAgo = startOfDay(now, 29)
  const monthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(now, undefined, -1)
  const ninetyDaysAgo = startOfDay(now, 89)
  const mixFrom = startOfDay(now, MIX_WINDOW_DAYS - 1)
  const mapFrom = new Date(now.getTime() - MAP_RANGE_MS[opts.mapRange ?? '24h'])
  const liveOrder = ne(order.status, 'cancelled')
  const available = sql`${sellableStock.onHand} - ${sellableStock.reserved}`
  const lowStockLevel = lt(available, lowStockThreshold + 1)
  // The same rule as Inventory's "Out of stock": live variants of products not archived (#72).
  const liveVariant = and(
    eq(variant.trackInventory, true),
    isNull(variant.archivedAt),
    ne(product.status, 'archived'),
  )
  const toShip = viewFilter('unfulfilled')
  const SERIES_DAYS = WINDOW_DAYS * 2

  /* The last 14 days of orders, by day (from `lastStart`), IST hour and the 24-hour activity
   * bar (hours since `dayAgo`): a few hundred rows at most, whatever the store's size. */
  const dayOf = stepIndex(order.placedAt, lastStart, DAY_MS)
  const hourOf = istHourSql(order.placedAt)
  const activityHour = sql<number | null>`case when ${order.placedAt} >= ${ts(dayAgo)}
    then least(${int(HOURS - 1)}, ${stepIndex(order.placedAt, dayAgo, 3_600_000)}) end`
  const recentQuery = tx
    .select({
      day: dayOf,
      hour: hourOf,
      activityHour,
      live: countWhere(liveOrder),
      livePaise: sumWhere(order.totalPaise, liveOrder),
      liveBeforeNow: countWhere(and(liveOrder, lt(order.placedAt, now))),
      // Pending: open orders still waiting for their money (COD included).
      pending: countWhere(
        and(eq(order.status, 'open'), inArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES])),
      ),
      cancelled: countWhere(eq(order.status, 'cancelled')),
    })
    .from(order)
    .where(and(notDraft, gte(order.placedAt, lastStart)))
    .groupBy(dayOf, hourOf, activityHour)

  /* Stock now and at the end of each of the 14 days: today's sellable levels with the
   * adjustment log undone backwards a day at a time (as `stockByDay` did), counted in SQL. */
  const stockRows = tx
    .select({
      variantId: sellableStock.variantId,
      available: sql<number>`${available}`.as('available'),
    })
    .from(sellableStock)
    .innerJoin(variant, eq(variant.id, sellableStock.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(liveVariant)
  const adjDay = stepIndex(inventoryAdjustment.createdAt, lastStart, DAY_MS)
  const adjustments = tx
    .select({
      variantId: inventoryAdjustment.variantId,
      day: sql<number>`${adjDay}`.as('day'),
      delta: sql<number>`sum(${inventoryAdjustment.delta})`.as('delta'),
    })
    .from(inventoryAdjustment)
    .where(gte(inventoryAdjustment.createdAt, lastStart))
    .groupBy(inventoryAdjustment.variantId, adjDay)
  const stockSeriesQuery = tx.execute<{ day: number; in_stock: number; out_of_stock: number }>(sql`
    with s as (${stockRows}), a as (${adjustments}),
    per_day as (
      select d.day, s.available - coalesce(sum(a.delta), 0) as available
      from s cross join generate_series(0, ${SERIES_DAYS - 1}) as d(day)
      left join a on a.variant_id = s.variant_id and a.day > d.day and a.day < ${SERIES_DAYS}
      group by d.day, s.variant_id, s.available
    )
    select day, count(*) filter (where available > 0)::int as in_stock,
      count(*) filter (where available <= 0)::int as out_of_stock
    from per_day group by day`)

  const newCustomerDay = stepIndex(customer.createdAt, lastStart, DAY_MS)
  const newProductDay = stepIndex(product.createdAt, lastStart, DAY_MS)
  const revenueDay = istDaySql(order.placedAt)
  const mixWeekday = istWeekdaySql(order.placedAt)
  const mixHour = istHourSql(order.placedAt)

  const [
    recentGroups,
    stockSeriesRows,
    [customersRow],
    [productsRow],
    newCustomerRows,
    newProductRows,
    [allTimeRevenue],
    recentOrders,
    topRows,
    lowStockRows,
    stateRows,
    typeRows,
    latestRows,
    [toShipTodayRow],
    [ordersToShipRow],
    [upiToVerifyRow],
    [lowStockCountRow],
    [preorderBalanceDueRow],
    [unpaidRow],
    [preorderShipSoonRow],
    [returnsToReviewRow],
    storeRows,
    revenueRows,
    mapOrderRows,
    mixRows,
  ] = await Promise.all([
    recentQuery,
    stockSeriesQuery,
    tx.select({ n: count() }).from(customer),
    // The same count as the Products list's "All" (archived included): Home read 307, the list 309 (#61).
    tx.select({ n: count() }).from(product).where(notSystemTest),
    tx
      .select({ day: newCustomerDay, n: count() })
      .from(customer)
      .where(gte(customer.createdAt, lastStart))
      .groupBy(newCustomerDay),
    tx
      .select({ day: newProductDay, n: count() })
      .from(product)
      .where(and(gte(product.createdAt, lastStart), notSystemTest))
      .groupBy(newProductDay),
    tx
      .select({ total: sum(order.totalPaise).mapWith(Number) })
      .from(order)
      .where(and(notDraft, liveOrder)),
    tx
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
      .limit(RECENT_ORDERS),
    tx
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
      .where(and(notDraft, liveOrder, gte(order.placedAt, thirtyDaysAgo)))
      .groupBy(variant.productId, product.title, product.handle)
      .orderBy(desc(sum(orderLine.quantity)))
      .limit(TOP_PRODUCTS),
    tx
      .select({
        variantId: variant.id,
        productId: variant.productId,
        title: product.title,
        variantTitle: variant.title,
        available: sql<number>`${available}`.mapWith(Number),
      })
      .from(sellableStock)
      .innerJoin(variant, eq(variant.id, sellableStock.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(and(liveVariant, lowStockLevel))
      .orderBy(asc(available))
      .limit(LOW_STOCK_ROWS),
    tx
      .select({
        stateCode: address.stateCode,
        revenuePaise: sum(order.totalPaise).mapWith(Number),
        orders: count(),
      })
      .from(order)
      .innerJoin(address, eq(address.id, order.shippingAddressId))
      .where(and(notDraft, liveOrder, gte(order.placedAt, thirtyDaysAgo)))
      .groupBy(address.stateCode)
      .orderBy(desc(sum(order.totalPaise))),
    tx
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
      .limit(CATEGORY_ROWS),
    tx
      .select({ productId: product.id, title: product.title })
      .from(product)
      .where(and(ne(product.status, 'archived'), notSystemTest))
      .orderBy(desc(product.createdAt))
      .limit(LATEST_PRODUCTS),
    // Same rule as the Unfulfilled list "Ship N orders" opens, so the counts match (COD included).
    tx
      .select({ n: count() })
      .from(order)
      .where(and(toShip, gte(order.placedAt, todayStart))),
    // "Waiting N days" skips orders held for a pre-order line that has not shipped yet: they are
    // waiting on stock, not on the merchant.
    tx
      .select({
        n: count(),
        oldestAt: sql<Date | null>`min(${order.placedAt}) filter (where not exists (
          select 1 from order_line ol where ol.order_id = "order".id and ol.preorder
          and (ol.preorder_ship_date is null or ol.preorder_ship_date > now())))`,
      })
      .from(order)
      .where(toShip),
    tx
      .select({ n: count() })
      .from(order)
      .where(
        and(
          eq(order.status, 'open'),
          isNull(order.checkoutPaidAt),
          eq(order.paymentMethod, 'manual'),
          isNull(order.importedFrom),
        ),
      ),
    // "Restock N products" counts products (one with three sold-out sizes is one), not variants,
    // and skips archived variants: it read 1,219 on a store of 307 products (audit #2).
    tx
      .select({ n: sql<number>`count(distinct ${product.id})`.mapWith(Number) })
      .from(sellableStock)
      .innerJoin(variant, eq(variant.id, sellableStock.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(and(liveVariant, lowStockLevel)),
    tx
      .select({ n: count() })
      .from(order)
      .where(and(viewFilter('balance_due'), ne(order.status, 'draft'))),
    tx.select({ n: count() }).from(order).where(viewFilter('unpaid')),
    tx
      .select({ n: count() })
      .from(preorderCampaign)
      .where(
        and(
          eq(preorderCampaign.status, 'active'),
          gte(preorderCampaign.shipDate, now),
          lt(preorderCampaign.shipDate, new Date(now.getTime() + 7 * DAY_MS)),
        ),
      ),
    tx.select({ n: count() }).from(returnRequest).where(eq(returnRequest.status, 'requested')),
    opts.storeId
      ? tx
          .select({ apps: store.apps, address: store.address })
          .from(store)
          .where(eq(store.id, opts.storeId))
      : Promise.resolve([]),
    /* Revenue per IST day for 90 days: the month ring, best day, streak and last month. */
    tx
      .select({ day: revenueDay, paise: sumInt(order.totalPaise) })
      .from(order)
      .where(and(notDraft, liveOrder, gte(order.placedAt, ninetyDaysAgo)))
      .groupBy(revenueDay)
      .orderBy(revenueDay),
    /* Orders with a shipping address over the globe's chosen time range, for its markers/arcs. */
    tx
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
      .where(and(notDraft, liveOrder, gte(order.placedAt, mapFrom)))
      .orderBy(desc(order.placedAt))
      .limit(MAP_ORDERS),
    /* Payment mix, status mix and the hours heatmap: 30 days of orders, grouped. */
    tx
      .select({
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        paymentMethod: order.paymentMethod,
        weekday: mixWeekday,
        hour: mixHour,
        n: count(),
      })
      .from(order)
      .where(and(notDraft, gte(order.placedAt, mixFrom)))
      .groupBy(order.status, order.fulfillmentStatus, order.paymentMethod, mixWeekday, mixHour),
  ])

  /* Windows, the revenue series, today and yesterday, from the 14-day groups. */
  const cur = { sales: 0, orders: 0, pending: 0, cancelled: 0 }
  const prev = { sales: 0, orders: 0, pending: 0, cancelled: 0 }
  const revenueByDay = zeros(SERIES_DAYS)
  const perHour = zeros(HOURS)
  const todayHourly = zeros(HOURS)
  const yesterdayHourly = zeros(HOURS)
  const today = { orders: 0, sales: 0 }
  for (const g of recentGroups) {
    const w = g.day >= WINDOW_DAYS ? cur : prev
    w.sales += g.livePaise
    w.orders += g.live
    w.pending += g.pending
    w.cancelled += g.cancelled
    if (g.day < SERIES_DAYS) revenueByDay[g.day] = (revenueByDay[g.day] ?? 0) + g.livePaise
    if (g.activityHour !== null) {
      perHour[g.activityHour] = (perHour[g.activityHour] ?? 0) + g.live
    }
    if (g.day >= SERIES_DAYS - 1) {
      today.orders += g.live
      today.sales += g.livePaise
    }
    if (g.day === SERIES_DAYS - 1) {
      todayHourly[g.hour] = (todayHourly[g.hour] ?? 0) + g.liveBeforeNow
    }
    if (g.day === SERIES_DAYS - 2) {
      yesterdayHourly[g.hour] = (yesterdayHourly[g.hour] ?? 0) + g.live
    }
  }

  const inStockByDay = zeros(SERIES_DAYS)
  const outOfStockByDay = zeros(SERIES_DAYS)
  for (const r of stockSeriesRows) {
    inStockByDay[Number(r.day)] = Number(r.in_stock)
    outOfStockByDay[Number(r.day)] = Number(r.out_of_stock)
  }
  const byDayIndex = (rows: { day: number; n: number }[]) => {
    const out = zeros(SERIES_DAYS)
    for (const r of rows) if (r.day >= 0 && r.day < SERIES_DAYS) out[r.day] = r.n
    return out
  }
  const customersByDay = byDayIndex(newCustomerRows)
  const productsByDay = byDayIndex(newProductRows)
  const seriesDays = Array.from({ length: SERIES_DAYS }, (_, i) =>
    isoDate(new Date(lastStart.getTime() + i * DAY_MS)),
  )
  const sliceSeries = (from: number): DashboardSeries => ({
    days: seriesDays.slice(from, from + WINDOW_DAYS),
    customers: customersByDay.slice(from, from + WINDOW_DAYS),
    products: productsByDay.slice(from, from + WINDOW_DAYS),
    inStock: inStockByDay.slice(from, from + WINDOW_DAYS),
    outOfStock: outOfStockByDay.slice(from, from + WINDOW_DAYS),
    revenuePaise: revenueByDay.slice(from, from + WINDOW_DAYS),
  })

  /* Images, prices and stock for the products the cards show: one more round, all at once. */
  const topIds = topRows.map((r) => r.productId)
  const coverTypes = typeRows.map((r) => r.type ?? '')
  const shownIds = [
    ...new Set([
      ...topIds,
      ...lowStockRows.map((r) => r.productId),
      ...latestRows.map((r) => r.productId),
    ]),
  ]
  const [images, stockByProduct, coverRows, latestPrices] = await Promise.all([
    firstImages(tx, shownIds),
    topIds.length
      ? tx
          .select({
            productId: variant.productId,
            pricePaise: sql<number>`min(${variant.pricePaise})`.mapWith(Number),
            inStock: sql<boolean>`bool_or(${variant.trackInventory} = false or coalesce(${available}, 0) > 0)`,
          })
          .from(variant)
          .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
          .where(inArray(variant.productId, topIds))
          .groupBy(variant.productId)
      : Promise.resolve([]),
    // The newest product of each top type, for its cover image.
    coverTypes.length
      ? tx
          .selectDistinctOn([product.productType], {
            type: product.productType,
            productId: product.id,
          })
          .from(product)
          .where(
            and(
              ne(product.status, 'archived'),
              notSystemTest,
              inArray(product.productType, coverTypes),
            ),
          )
          .orderBy(product.productType, desc(product.createdAt))
      : Promise.resolve([]),
    latestRows.length
      ? tx
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
      : Promise.resolve([]),
  ])
  const coverByType = new Map<string, string>()
  for (const r of coverRows) if (r.type) coverByType.set(r.type, r.productId)
  const coverIds = [...coverByType.values()].filter((id) => !images.has(id))
  for (const [id, url] of await firstImages(tx, coverIds)) images.set(id, url)
  const stockInfo = new Map(stockByProduct.map((r) => [r.productId, r]))
  const priceByProduct = new Map(latestPrices.map((r) => [r.productId, r.pricePaise]))

  const stateTotal = stateRows.reduce((n, r) => n + r.revenuePaise, 0)
  const salesByState = stateRows.slice(0, STATE_ROWS).map((r) => ({
    ...r,
    share: stateTotal > 0 ? r.revenuePaise / stateTotal : 0,
  }))

  const liveVisitors =
    opts.visitors && opts.storeId
      ? await opts.visitors.live(opts.storeId)
      : { last30: 0, perMinute: Array.from({ length: LIVE_MINUTES }, () => 0) }
  /* Visitors today and yesterday (IST days), for the hero's Visitors and Conversion tiles. */
  const visitorDays = [istIsoDate(yesterdayStart), istIsoDate(todayStart)]
  const dailyVisitors =
    opts.visitors?.daily && opts.storeId
      ? await opts.visitors.daily(opts.storeId, visitorDays)
      : { perDay: [0, 0], total: 0 }
  const [visitorsYesterday = 0, visitorsToday = 0] = dailyVisitors.perDay

  let gstQueued: { count: number; href: string } | null = null
  let dispatch: DashboardSummary['dispatch'] = null
  const [storeRow] = storeRows
  if (opts.storeId) {
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
  const salesChange = prev.sales > 0 ? (cur.sales - prev.sales) / prev.sales : null
  const bestSeller = topRows[0] ? { title: topRows[0].title, units: topRows[0].units } : null

  /* This month, in IST: sales-goal ring and a streak line. */
  const shifted = wallClock(now)
  const dayOfMonth = shifted.getUTCDate()
  const daysInMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const monthKey = isoDate(monthStart)
  const lastMonthKey = isoDate(lastMonthStart)
  let monthToDatePaise = 0
  let lastMonthSalesPaise = 0
  let bestDayPaise = 0
  let bestDay: string | null = null
  const byDay = new Map<string, number>()
  for (const r of revenueRows) {
    byDay.set(r.day, r.paise)
    // From the whole month (the rows reach back 90 days), not the 14-day window above:
    // from the 15th that window no longer held the month's first days.
    if (r.day >= monthKey) monthToDatePaise += r.paise
    else if (r.day >= lastMonthKey) lastMonthSalesPaise += r.paise
    if (r.paise > bestDayPaise) {
      bestDayPaise = r.paise
      bestDay = r.day
    }
  }
  const projectedPaise =
    dayOfMonth > 0 ? Math.round((monthToDatePaise / dayOfMonth) * daysInMonth) : 0
  let streakDays = 0
  for (let i = 0; i < WINDOW_DAYS * 2; i++) {
    const day = isoDate(new Date(todayStart.getTime() - i * DAY_MS))
    if ((byDay.get(day) ?? 0) > 0) streakDays++
    else break
  }

  const paymentCounts = new Map<string, number>()
  const statusCounts = new Map<string, number>()
  const hoursHeatmap: number[][] = Array.from({ length: 7 }, () => zeros(HOURS))
  for (const r of mixRows) {
    const bucket = statusBucket(r)
    if (bucket) statusCounts.set(bucket, (statusCounts.get(bucket) ?? 0) + r.n)
    if (r.status === 'cancelled') continue
    const label = paymentMethodLabel(r.paymentMethod)
    paymentCounts.set(label, (paymentCounts.get(label) ?? 0) + r.n)
    const row = hoursHeatmap[r.weekday]
    if (row) row[r.hour] = (row[r.hour] ?? 0) + r.n
  }
  const paymentMix = [...paymentCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const statusMix = (['to_ship', 'shipped', 'delivered', 'cancelled'] as const).map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }))

  return {
    sales: { value: cur.sales, previous: prev.sales },
    orders: { value: cur.orders, previous: prev.orders },
    pending: { value: cur.pending, previous: prev.pending },
    cancelled: { value: cur.cancelled, previous: prev.cancelled },
    report: {
      customers: customersRow?.n ?? 0,
      products: productsRow?.n ?? 0,
      inStock: inStockByDay[SERIES_DAYS - 1] ?? 0,
      outOfStock: outOfStockByDay[SERIES_DAYS - 1] ?? 0,
      revenuePaise: allTimeRevenue?.total ?? 0,
      thisWeek: sliceSeries(WINDOW_DAYS),
      lastWeek: sliceSeries(0),
    },
    recentOrders,
    topProducts: topRows.map((r) => ({
      ...r,
      imageUrl: images.get(r.productId) ?? null,
      pricePaise: stockInfo.get(r.productId)?.pricePaise ?? 0,
      inStock: stockInfo.get(r.productId)?.inStock ?? true,
    })),
    lowStock: lowStockRows.map((r) => ({ ...r, imageUrl: images.get(r.productId) ?? null })),
    activity: { ordersLast24h: perHour.reduce((n, v) => n + v, 0), perHour },
    liveVisitors,
    categories: typeRows.map((r) => ({
      type: r.type ?? '',
      count: r.n,
      imageUrl: (r.type && images.get(coverByType.get(r.type) ?? '')) || null,
    })),
    latestProducts: latestRows.map((r) => ({
      ...r,
      pricePaise: priceByProduct.get(r.productId) ?? 0,
      imageUrl: images.get(r.productId) ?? null,
    })),
    salesByState,
    today: {
      ordersCount: today.orders,
      salesPaise: today.sales,
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

/** Each product's first image (lowest position), for the cards' thumbnails. */
async function firstImages(tx: StoreTx, productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map()
  const rows = await tx
    .selectDistinctOn([productMedia.productId], {
      productId: productMedia.productId,
      url: media.url,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, productIds))
    .orderBy(productMedia.productId, asc(productMedia.position))
  return new Map(rows.map((r) => [r.productId, r.url]))
}

/**
 * The range-switch chart data for the home page: sales and order counts for `range`
 * days against the same span before it, plus the top 5 products by revenue in that
 * range. Separate from `dashboardSummary` so switching the range only refetches this.
 * Orders are summed per day in Postgres.
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

  const day = stepIndex(order.placedAt, prevFrom, DAY_MS)
  const revenueExpr = sql<number>`sum(${orderLine.quantity} * ${orderLine.unitPricePaise})`
  const [rows, topRows] = await Promise.all([
    tx
      .select({ day, paise: sumInt(order.totalPaise), n: count() })
      .from(order)
      .where(and(notDraft, ne(order.status, 'cancelled'), gte(order.placedAt, prevFrom)))
      .groupBy(day),
    tx
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
      .limit(TOP_PRODUCTS),
  ])

  const days = Array.from({ length: range }, (_, i) =>
    isoDate(new Date(from.getTime() + i * DAY_MS)),
  )
  const previousDays = Array.from({ length: range }, (_, i) =>
    isoDate(new Date(prevFrom.getTime() + i * DAY_MS)),
  )
  const salesPaise = zeros(range)
  const orders = zeros(range)
  const previousSalesPaise = zeros(range)
  let hasPrevious = false
  for (const r of rows) {
    if (r.day >= range && r.day < range * 2) {
      salesPaise[r.day - range] = r.paise
      orders[r.day - range] = r.n
    } else if (r.day >= 0 && r.day < range) {
      hasPrevious = true
      previousSalesPaise[r.day] = r.paise
    }
  }
  const [visitorDaily, images] = await Promise.all([
    opts.visitors?.daily && opts.storeId
      ? opts.visitors.daily(opts.storeId, [...previousDays, ...days])
      : Promise.resolve({ perDay: zeros(range * 2), total: 0 }),
    firstImages(
      tx,
      topRows.map((r) => r.productId),
    ),
  ])

  return {
    range,
    days,
    salesPaise,
    orders,
    previousSalesPaise: hasPrevious ? previousSalesPaise : null,
    visitors: visitorDaily.perDay.slice(range),
    previousVisitors: visitorDaily.perDay.slice(0, range),
    topProducts: topRows.map((r) => ({ ...r, imageUrl: images.get(r.productId) ?? null })),
  }
}
