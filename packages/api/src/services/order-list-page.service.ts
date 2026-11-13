/**
 * The Orders list's rows, counts and stat cards: `orders.list`, `tabCounts`, `tiles`, the
 * sidebar's orders to ship, and `orders.listPage`, the page's server render in one transaction.
 */
import {
  notTestOrder,
  type OrderStatus,
  UNFULFILLED_STATUSES,
  UNPAID_PAYMENT_STATUSES,
} from '@commerce/core'
import { startOfDay } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { address, customer, media, order, orderLine, productMedia, variant } from '@commerce/db'
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { notDraft, type OrderListFilters, onHoldSql, orderListWhere } from './order-list-where'
import { pendingUpiTile } from './order-views'

const latestShipment = <T>(column: string) =>
  sql<T>`(select ${sql.raw(column)} from shipment s where s.order_id = ${order.id}
    order by s.created_at desc limit 1)`

type OrderListPageInput = OrderListFilters & { page: number; perPage: number }

/** One page of the Orders list's rows, newest first. */
function orderRows(tx: StoreTx, input: OrderListPageInput) {
  return tx
    .select({
      id: order.id,
      number: order.number,
      /* `notDraft` in the filter guarantees the narrower type callers rely on. */
      status: sql<OrderStatus>`${order.status}`,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentMethod: order.paymentMethod,
      /** Set while it is a read-only import; the row menu then offers only safe items (#47). */
      importedFrom: order.importedFrom,
      totalPaise: order.totalPaise,
      email: order.email,
      customerName: customer.name,
      /* Paid on a gateway's test keys: the list shows a "Test" chip. */
      isTest: order.isTest,
      placedAt: order.placedAt,
      /* The Channel and Tags columns (Figma "State · Columns open"): where the visit came from. */
      channel: sql<string | null>`${order.attribution}->>'channel'`,
      tags: order.tags,
      archivedAt: order.archivedAt,
      /* Fulfilment held (#1011): the row shows an "On hold" chip. */
      onHold: onHoldSql,
      /* Frame 5:2353 shows the first product with its picture; the rest is a count. */
      firstLineTitle: sql<string | null>`(
        select ol.title from ${orderLine} ol where ol.order_id = ${order.id}
        order by ol.id limit 1)`,
      lineCount: sql<number>`(select count(*)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
      /* The optional Items, Delivery, Phone and City columns (audit #7, #49). */
      itemCount: sql<number>`(select coalesce(sum(ol.quantity), 0)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
      deliveryStatus: latestShipment<string | null>('s.status'),
      labelLive: latestShipment<boolean | null>('s.label_url is not null'),
      trackingUrl: latestShipment<string | null>('s.tracking_url'), // the Delivery chip's link (#1008)
      shipCity: sql<
        string | null
      >`(select a.city from ${address} a where a.id = ${order.shippingAddressId})`,
      shipPhone: sql<
        string | null
      >`(select a.phone from ${address} a where a.id = ${order.shippingAddressId})`,
      firstLineImage: sql<string | null>`(
        select coalesce(vm.url, (
          select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
          where pm.product_id = v.product_id order by pm.position limit 1))
        from ${orderLine} ol
        join ${variant} v on v.id = ol.variant_id
        left join ${media} vm on vm.id = v.media_id
        where ol.order_id = ${order.id} order by ol.id limit 1)`,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(orderListWhere(input))
    .orderBy(desc(order.placedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
}

/* Store-wide, whatever the filters: "Delete test orders" shows only when there are some. */
const testOrdersSql = sql<number>`(count(*) filter (where ${order.isTest}))::int`

/** Orders, a page at a time, with how many match and how many test orders the store has. */
export async function listOrders(tx: StoreTx, input: OrderListPageInput) {
  const [[countRow], items, [testRow]] = await Promise.all([
    tx
      .select({ total: count() })
      .from(order)
      .leftJoin(customer, eq(customer.id, order.customerId))
      .where(orderListWhere(input)),
    orderRows(tx, input),
    tx.select({ n: count() }).from(order).where(eq(order.isTest, true)),
  ])
  return { items, total: countRow?.total ?? 0, testOrders: testRow?.n ?? 0 }
}

/** The Orders list's tab badges, the same rows each tab lists with no search or filter. */
export type OrderTabCounts = {
  all: number
  unpaid: number
  unfulfilled: number
  pendingUpi: number
}

/** An aggregate column: how many rows match `where` (all of them without one). */
const countWhere = (where: SQL | undefined) =>
  sql<number>`(count(*) filter (where ${where ?? sql`true`}))::int`

/** The tab badges as aggregate columns over `order` (`orderTabCounts`, `orderListPage`). */
function tabCountColumns() {
  const tab = (view?: 'unpaid' | 'unfulfilled' | 'pending_upi') =>
    countWhere(orderListWhere(view ? { view } : {}))
  return {
    all: tab(),
    unpaid: tab('unpaid'),
    unfulfilled: tab('unfulfilled'),
    pendingUpi: tab('pending_upi'),
  }
}

/**
 * Every tab badge in one pass over the store's orders: each count is the tab's own where clause
 * (`orderListWhere`), so a badge always matches the rows its tab shows. One query instead of a
 * full list read (count, rows and test count) per tab.
 */
export async function orderTabCounts(tx: StoreTx): Promise<OrderTabCounts> {
  const [row] = await tx.select(tabCountColumns()).from(order).where(notDraft)
  // An aggregate with no GROUP BY always returns one row, and `count(*)` is never null.
  return row ?? { all: 0, unpaid: 0, unfulfilled: 0, pendingUpi: 0 }
}

export type OrderTiles = {
  /** Orders placed since midnight (IST) and the count by the same time yesterday. */
  newToday: { value: number; previous: number }
  /** Open orders that are paid (or cash on delivery) and still to pack. */
  readyToShip: number
  /** Manual UPI / bank transfers waiting to be matched. */
  pendingUpi: number
  /** Money from orders placed in the last 7 days (not cancelled) and the 7 days before. */
  salesWeek: { paise: number; previousPaise: number }
}

/**
 * Open orders nobody has shipped yet that are paid, authorised (the card is approved and the
 * money is captured on shipping, as Shopify counts them), or cash on delivery: "Ready to ship".
 */
const readyToShipWhere = () =>
  and(
    eq(order.status, 'open'),
    isNull(order.archivedAt),
    inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
    or(
      notInArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
      eq(order.paymentStatus, 'authorized'),
      eq(order.paymentMethod, 'cod'),
    ),
  )

/** How many orders wait to ship: the count pill on the sidebar's Orders row (Figma). */
export async function readyToShipCount(tx: StoreTx): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(order).where(readyToShipWhere())
  return row?.n ?? 0
}

/**
 * The four stat cards as aggregate columns over every `order` row (drafts too: Pending UPI
 * counts transfer checkouts kept as drafts), each card with its own filter. Named `tile…` so
 * none clashes with a tab badge (`pendingUpi`) in `orderListPage`'s one select.
 */
function tileColumns(now: Date) {
  const todayStart = startOfDay(now)
  const yesterdayStart = startOfDay(now, undefined, -1)
  const sameTimeYesterday = new Date(now.getTime() - 86_400_000)
  const weekStart = new Date(now.getTime() - 7 * 86_400_000)
  const lastWeekStart = new Date(now.getTime() - 14 * 86_400_000)
  // Test-mode orders (gateway test keys) moved no real money: not counted as new or as sales.
  const live = and(notDraft, ne(order.status, 'cancelled'), notTestOrder)
  const paise = (where: SQL | undefined) =>
    sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${where ?? sql`true`}), 0)::bigint`.mapWith(
      Number,
    )
  return {
    tileToday: countWhere(and(live, gte(order.placedAt, todayStart))),
    tileYesterday: countWhere(
      and(live, gte(order.placedAt, yesterdayStart), lte(order.placedAt, sameTimeYesterday)),
    ),
    tileReadyToShip: countWhere(readyToShipWhere()),
    tilePendingUpi: countWhere(pendingUpiTile()),
    tileSalesWeek: paise(and(live, gte(order.placedAt, weekStart))),
    tileSalesLastWeek: paise(
      and(live, gte(order.placedAt, lastWeekStart), lt(order.placedAt, weekStart)),
    ),
  }
}

type TileRow = { [K in keyof ReturnType<typeof tileColumns>]: number }

function tilesOf(row: TileRow | undefined): OrderTiles {
  return {
    newToday: { value: row?.tileToday ?? 0, previous: row?.tileYesterday ?? 0 },
    readyToShip: row?.tileReadyToShip ?? 0,
    pendingUpi: row?.tilePendingUpi ?? 0,
    salesWeek: { paise: row?.tileSalesWeek ?? 0, previousPaise: row?.tileSalesLastWeek ?? 0 },
  }
}

/** The four stat cards above the Orders list (Figma "Orders / List"), in one statement. */
export async function orderTiles(tx: StoreTx, now = new Date()): Promise<OrderTiles> {
  const [row] = await tx.select(tileColumns(now)).from(order)
  return tilesOf(row)
}

/**
 * Everything the Orders page renders on the server, in one transaction: the first page of rows
 * and one aggregate over the store's orders for the match count, the test orders, the tab
 * badges and the stat cards (they used to be four calls and nine statements). The rows'
 * `total` is the list's own where clause, so it matches `listOrders` exactly.
 */
export async function orderListPage(tx: StoreTx, input: OrderListPageInput, now = new Date()) {
  const counts = tx
    .select({
      total: countWhere(orderListWhere(input)),
      testOrders: testOrdersSql,
      ...tabCountColumns(),
      ...tileColumns(now),
    })
    .from(order)
  // The search also matches the customer's name; nothing else in the aggregate reads it.
  const [[row], items] = await Promise.all([
    input.search ? counts.leftJoin(customer, eq(customer.id, order.customerId)) : counts,
    orderRows(tx, input),
  ])
  return {
    result: { items, total: row?.total ?? 0, testOrders: row?.testOrders ?? 0 },
    counts: {
      all: row?.all ?? 0,
      unpaid: row?.unpaid ?? 0,
      unfulfilled: row?.unfulfilled ?? 0,
      pendingUpi: row?.pendingUpi ?? 0,
    },
    tiles: tilesOf(row),
  }
}
