import { notTestOrder } from '@commerce/core'
import {
  fieldOf,
  type ParsedQuery,
  parseQuery,
  type QueryError,
  type QueryFieldType,
  type QueryTime,
} from '@commerce/core/analytics-query'
import { address, order, orderLine, type StoreTx } from '@commerce/db'
import { and, asc, desc, eq, gte, lt, ne, type SQL, sql } from 'drizzle-orm'
import { DAY_MS, istIsoDate, resolveRange } from './analytics-buckets'
import type { ReportResult } from './analytics-report.service'
import type { ReportColumnKind, ReportDefinition } from './analytics-reports'
import type { ReportRow, ReportValue } from './reports/types'

/*
 * Custom analytics queries (Figma "Analytics · Report — query editor"). The query is parsed by
 * the same code the editor runs, then every field becomes one of the fixed expressions below:
 * a merchant's text never reaches SQL. Reads only, inside the caller's store transaction (RLS).
 */

const IST = sql.raw(`'Asia/Kolkata'`)
const day = sql<string>`to_char(${order.placedAt} at time zone ${IST}, 'YYYY-MM-DD')`
const month = sql<string>`to_char(${order.placedAt} at time zone ${IST}, 'YYYY-MM')`

const SALES: Record<string, SQL> = {
  net_sales: sql`coalesce(sum(${order.subtotalPaise} - ${order.discountPaise}), 0)::bigint`,
  gross_sales: sql`coalesce(sum(${order.subtotalPaise}), 0)::bigint`,
  discounts: sql`coalesce(sum(${order.discountPaise}), 0)::bigint`,
  shipping: sql`coalesce(sum(${order.shippingPaise}), 0)::bigint`,
  taxes: sql`coalesce(sum(${order.taxPaise}), 0)::bigint`,
  total_sales: sql`coalesce(sum(${order.totalPaise}), 0)::bigint`,
  orders: sql`count(*)::int`,
  average_order_value: sql`coalesce(round(avg(${order.totalPaise})), 0)::bigint`,
  cod_orders: sql`(count(*) filter (where ${order.paymentMethod} = 'cod'))::int`,
  day,
  month,
  state: sql`coalesce(${address.stateCode}, '')`,
  payment_method: sql`coalesce(${order.paymentMethod}, '')`,
  channel: sql`coalesce(${order.attribution} ->> 'channel', '')`,
}

const PRODUCTS: Record<string, SQL> = {
  net_quantity: sql`coalesce(sum(${orderLine.quantity}), 0)::int`,
  gross_sales: sql`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}), 0)::bigint`,
  cost: sql`coalesce(sum(${orderLine.quantity} * ${orderLine.costAtSalePaise}), 0)::bigint`,
  orders: sql`count(distinct ${order.id})::int`,
  product_title: sql`coalesce(${orderLine.title}, '')`,
  variant_title: sql`coalesce(${orderLine.variantTitle}, '')`,
  day,
  month,
  state: sql`coalesce(${address.stateCode}, '')`,
}

const KIND: Record<QueryFieldType, ReportColumnKind> = {
  money: 'money',
  number: 'count',
  text: 'text',
  date: 'date',
  month: 'month',
  state: 'state',
  payment: 'payment',
}

type Span = { from: Date; to: Date }

/** IST calendar day a SINCE / UNTIL word points at. */
function dayOf(t: QueryTime, now: Date): string {
  if (t.kind === 'date') return t.iso
  if (t.kind === 'word')
    return istIsoDate(new Date(now.getTime() - (t.word === 'yesterday' ? DAY_MS : 0)))
  const d = new Date(now)
  if (t.unit === 'm') d.setUTCMonth(d.getUTCMonth() - t.amount)
  else d.setTime(d.getTime() - t.amount * (t.unit === 'w' ? 7 : 1) * DAY_MS)
  return istIsoDate(d)
}

async function run(tx: StoreTx, q: ParsedQuery, span: Span, grouped: boolean) {
  const exprs = q.table === 'sales' ? SALES : PRODUCTS
  const select: Record<string, SQL> = {}
  const dim = grouped && q.groupBy ? (exprs[q.groupBy] as SQL) : null
  if (dim) select.key = dim
  for (const m of q.show) select[m] = exprs[m] as SQL
  const where = and(
    ne(order.status, 'draft'),
    ne(order.status, 'cancelled'),
    notTestOrder,
    gte(order.placedAt, span.from),

    lt(order.placedAt, span.to),
  )
  const base =
    q.table === 'sales'
      ? tx.select(select).from(order).leftJoin(address, eq(address.id, order.shippingAddressId))
      : tx
          .select(select)
          .from(orderLine)
          .innerJoin(order, eq(order.id, orderLine.orderId))
          .leftJoin(address, eq(address.id, order.shippingAddressId))
  const filtered = base.where(where)
  if (!dim) return (await filtered) as Record<string, unknown>[]
  const sortExpr = q.orderBy ? (exprs[q.orderBy.field] as SQL) : dim
  const sorted = filtered
    .groupBy(dim)
    .orderBy(q.orderBy?.dir === 'asc' || !q.orderBy ? asc(sortExpr) : desc(sortExpr))
  return (await sorted.limit(q.limit)) as Record<string, unknown>[]
}

const value = (v: unknown): ReportValue =>
  v == null ? null : typeof v === 'number' ? v : /^-?\d+$/.test(String(v)) ? Number(v) : String(v)

export type CustomQueryResult =
  | { ok: true; report: ReportDefinition; result: ReportResult; ms: number }
  | { ok: false; error: QueryError }

/** Parses, checks and runs one custom query for the current store. */
export async function runCustomQuery(
  tx: StoreTx,
  source: string,
  now = new Date(),
): Promise<CustomQueryResult> {
  const parsed = parseQuery(source)
  if (!parsed.ok) return parsed
  const q = parsed.query
  const started = performance.now()
  const range = resolveRange(
    { key: 'custom', from: dayOf(q.since, now), to: dayOf(q.until, now) },
    now,
  )
  const span = { from: range.from, to: range.to }
  const before: Span | null =
    q.compare === 'previous_period'
      ? { from: range.previousFrom, to: range.previousTo }
      : q.compare === 'previous_year'
        ? {
            from: new Date(range.from.getTime() - 365 * DAY_MS),
            to: new Date(range.to.getTime() - 365 * DAY_MS),
          }
        : null

  const [rows, totalsRow, prevRows, prevTotals] = await Promise.all([
    run(tx, q, span, true),
    run(tx, q, span, false),
    before ? run(tx, q, before, true) : Promise.resolve(null),
    before ? run(tx, q, before, false) : Promise.resolve(null),
  ])

  const metric =
    q.orderBy && q.show.includes(q.orderBy.field) ? q.orderBy.field : (q.show[0] as string)
  const dimField = q.groupBy ? fieldOf(q.table, q.groupBy) : null
  const columns = [
    ...(dimField ? [{ id: dimField.name, kind: KIND[dimField.type] }] : []),
    ...q.show.map((m) => ({
      id: m,
      kind: KIND[(fieldOf(q.table, m)?.type ?? 'number') as QueryFieldType],
    })),
  ]
  const prevByKey = new Map(
    (prevRows ?? []).map((r) => [String(r.key ?? 'total'), value(r[metric])]),
  )
  const toRow = (r: Record<string, unknown>): ReportRow => {
    const key = String(r.key ?? 'total')
    const values: Record<string, ReportValue> = {}
    if (dimField) values[dimField.name] = key
    for (const m of q.show) values[m] = value(r[m])
    const prev = prevByKey.get(key)
    return { key, values, previous: typeof prev === 'number' ? prev : null }
  }
  const resultRows = (q.groupBy ? rows : totalsRow).map(toRow)
  const totals = Object.fromEntries(q.show.map((m) => [m, value(totalsRow[0]?.[m])]))
  const series = q.groupBy === 'day' || q.groupBy === 'month'

  const report: ReportDefinition = {
    slug: 'custom',
    title: 'Custom query',
    description: '',
    category: 'sales',
    available: true,
    columns,
    metric,
    chart: series ? 'series' : 'bars',
    ranged: true,
  }
  const result: ReportResult = {
    slug: 'custom',
    range: {
      key: 'custom',
      from: range.days[0] ?? '',
      to: range.days.at(-1) ?? '',
      days: range.days,
    },
    previousRange: before
      ? { from: istIsoDate(before.from), to: istIsoDate(new Date(before.to.getTime() - 1)) }
      : null,
    rows: resultRows,
    totals,
    previousTotals: prevTotals
      ? Object.fromEntries(q.show.map((m) => [m, value(prevTotals[0]?.[m])]))
      : null,
    chart: resultRows.slice(0, series ? undefined : 12).map((r) => ({
      label: r.key,
      value: typeof r.values[metric] === 'number' ? (r.values[metric] as number) : 0,
      previous: r.previous ?? null,
    })),
    profit: null,
  }
  return { ok: true, report, result, ms: Math.round(performance.now() - started) }
}
