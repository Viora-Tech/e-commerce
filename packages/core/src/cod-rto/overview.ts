/** SOURCE OF TRUTH: COD & RTO app reports — WHAT: the overview (RTO rate for COD and prepaid, what the shopper said to the COD confirmation, open orders by risk level, the PIN codes that send parcels back most), the risky-orders list and one order's risk card / WHY: the app's admin pages read these, and they must count shipments the same way the Shipments workspace's RTO numbers do */
import { address, customer, order, shipment } from '@commerce/db'
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { rtoSummary } from '../returns/rto'
import type { CodVerification, RiskLevel, RiskOrderFilter } from './settings'

const DAY_MS = 86_400_000

const rate = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0

/** The overview page: the last `days` days, by when the parcel was booked. */
export async function codRtoOverview(ctx: StoreContext, days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY_MS)
  const isCod = sql`${order.paymentMethod} = 'cod'`
  const [byMethod] = await ctx.tx
    .select({
      codFinished: sql<number>`count(*) filter (where ${isCod} and ${shipment.status} in ('delivered', 'rto'))::int`,
      codRto: sql<number>`count(*) filter (where ${isCod} and ${shipment.status} = 'rto')::int`,
      prepaidFinished: sql<number>`count(*) filter (where not ${isCod} and ${shipment.status} in ('delivered', 'rto'))::int`,
      prepaidRto: sql<number>`count(*) filter (where not ${isCod} and ${shipment.status} = 'rto')::int`,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .where(gte(shipment.createdAt, since))
  const answers = await ctx.tx
    .select({ status: order.codVerification, n: count() })
    .from(order)
    .where(and(isNotNull(order.codVerification), gte(order.placedAt, since)))
    .groupBy(order.codVerification)
  const levels = await ctx.tx
    .select({ level: sql<RiskLevel>`${order.rtoRisk}->>'level'`, n: count() })
    .from(order)
    .where(
      and(
        isNotNull(order.rtoRisk),
        eq(order.status, 'open'),
        eq(order.fulfillmentStatus, 'unfulfilled'),
      ),
    )
    .groupBy(sql`${order.rtoRisk}->>'level'`)
  const [unscored] = await ctx.tx
    .select({ n: count() })
    .from(order)
    .where(
      and(
        isNull(order.rtoRisk),
        eq(order.status, 'open'),
        eq(order.fulfillmentStatus, 'unfulfilled'),
        isNotNull(order.shippingAddressId),
      ),
    )
  const pincodes = await ctx.tx
    .select({
      pincode: address.pincode,
      city: sql<string>`min(${address.city})`,
      finished: sql<number>`count(*)::int`,
      rto: sql<number>`count(*) filter (where ${shipment.status} = 'rto')::int`,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(gte(shipment.createdAt, since), inArray(shipment.status, ['delivered', 'rto'])))
    .groupBy(address.pincode)
    .having(sql`count(*) filter (where ${shipment.status} = 'rto') > 0`)
    .orderBy(desc(sql`count(*) filter (where ${shipment.status} = 'rto')`))
    .limit(8)
  const said = (s: CodVerification) => Number(answers.find((a) => a.status === s)?.n ?? 0)
  const open = (l: RiskLevel) => Number(levels.find((r) => r.level === l)?.n ?? 0)
  const m = {
    codFinished: Number(byMethod?.codFinished ?? 0),
    codRto: Number(byMethod?.codRto ?? 0),
    prepaidFinished: Number(byMethod?.prepaidFinished ?? 0),
    prepaidRto: Number(byMethod?.prepaidRto ?? 0),
  }
  const asked = said('pending') + said('confirmed') + said('cancelled') + said('unconfirmed')
  return {
    days,
    rto: await rtoSummary(ctx, days, now),
    cod: {
      ...m,
      codRate: rate(m.codRto, m.codFinished),
      prepaidRate: rate(m.prepaidRto, m.prepaidFinished),
    },
    confirmation: {
      asked,
      pending: said('pending'),
      confirmed: said('confirmed'),
      cancelled: said('cancelled'),
      unconfirmed: said('unconfirmed'),
      confirmedRate: rate(said('confirmed'), asked),
    },
    openByLevel: { low: open('low'), medium: open('medium'), high: open('high') },
    /** Open, unshipped orders with no score yet (imported, or placed before the app). */
    unscored: Number(unscored?.n ?? 0),
    pincodes: pincodes.map((p) => ({
      pincode: p.pincode,
      city: p.city,
      shipments: Number(p.finished),
      rto: Number(p.rto),
      ratePercent: rate(Number(p.rto), Number(p.finished)),
    })),
  }
}

function filterWhere(filter: RiskOrderFilter) {
  const level = sql`${order.rtoRisk}->>'level'`
  switch (filter) {
    case 'risky':
      return sql`${level} in ('medium', 'high')`
    case 'high':
      return sql`${level} = 'high'`
    case 'unconfirmed':
      return eq(order.codVerification, 'unconfirmed')
    case 'pending':
      return eq(order.codVerification, 'pending')
    case 'all':
      return sql`(${order.rtoRisk} is not null or ${order.codVerification} is not null)`
  }
}

/** The risky-orders page: scored or COD-checked orders, newest first. */
export async function listRiskOrders(
  ctx: StoreContext,
  input: { filter: RiskOrderFilter; page: number; perPage: number; openOnly: boolean },
) {
  const where = and(
    ne(order.status, 'draft'),
    filterWhere(input.filter),
    input.openOnly ? eq(order.status, 'open') : undefined,
  )
  const [rows, [total]] = await Promise.all([
    ctx.tx
      .select({
        id: order.id,
        number: order.number,
        placedAt: order.placedAt,
        totalPaise: order.totalPaise,
        paymentMethod: order.paymentMethod,
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        email: order.email,
        customerName: customer.name,
        risk: order.rtoRisk,
        verification: order.codVerification,
      })
      .from(order)
      .leftJoin(customer, eq(customer.id, order.customerId))
      .where(where)
      .orderBy(desc(order.placedAt))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage),
    ctx.tx.select({ n: count() }).from(order).where(where),
  ])
  return {
    items: rows.map(({ risk, ...r }) => ({
      ...r,
      score: risk?.score ?? null,
      level: risk?.level ?? null,
    })),
    total: Number(total?.n ?? 0),
    page: input.page,
    perPage: input.perPage,
  }
}

/** The order page's card: the score with its reasons, and where the COD confirmation stands. */
export async function orderCodRto(ctx: StoreContext, orderId: string) {
  const [o] = await ctx.tx
    .select({
      paymentMethod: order.paymentMethod,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      risk: order.rtoRisk,
      verification: order.codVerification,
      requestedAt: order.codVerifyRequestedAt,
      verifiedAt: order.codVerifiedAt,
      hasAddress: sql<boolean>`${order.shippingAddressId} is not null`,
    })
    .from(order)
    .where(eq(order.id, orderId))
  return o ?? null
}
