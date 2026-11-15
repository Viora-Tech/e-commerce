/**
 * SOURCE OF TRUTH: custom analytics query SQL — WHAT every query field as one fixed SQL
 * expression per table, and WHERE / HAVING compiled to SQL with bound values / WHY a
 * merchant's (or a model's) text only ever reaches the database as a parameter: field names
 * pick from these maps, values are bound, operators come from a closed list.
 */
import { NET_UNITS, notTestOrder, RETURNED_UNITS } from '@commerce/core'
import type { QueryCondition, QueryOperator, QueryTable } from '@commerce/core/analytics-query'
import { fieldOf } from '@commerce/core/analytics-query'
import { INDIAN_STATE_NAMES } from '@commerce/core/states'
import {
  address,
  collection,
  collectionProduct,
  customer,
  order,
  orderLine,
  product,
  refund,
  variant,
} from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'

/** Units sold on a line (ordered minus returned), for tools that sum it beside the query. */
export { NET_UNITS }

const IST = sql.raw(`'Asia/Kolkata'`)

/** How customer names may show: in full (staff who read customers), first name only (AI), or not at all. */
export type CustomerNames = 'full' | 'first' | 'hidden'

export type TableSql = {
  /** Metric and dimension expressions by field name. */
  exprs: Record<string, SQL>
  /** Filter-only fields: an EXISTS around a test on the inner value (one row, many values). */
  filters: Record<string, (test: (value: SQL) => SQL) => SQL>
  /** The rows: FROM and its joins. */
  from: SQL
  /** Rows that always count, before the merchant's WHERE. */
  base: SQL
  /** The instant SINCE / UNTIL and the calendar fields read. */
  at: SQL
}

function calendar(at: SQL): Record<string, SQL> {
  const local = sql`(${at} at time zone ${IST})`
  return {
    day: sql`to_char(${local}, 'YYYY-MM-DD')`,
    week: sql`to_char(date_trunc('week', ${local}), 'YYYY-MM-DD')`,
    month: sql`to_char(${local}, 'YYYY-MM')`,
    year: sql`to_char(${local}, 'YYYY')`,
  }
}

function customerName(names: CustomerNames): SQL {
  if (names === 'first') return sql`split_part(trim(coalesce(${customer.name}, '')), ' ', 1)`
  return sql`coalesce(${customer.name}, '')`
}

/** What an order carries, shared by the tables built on orders. */
function orderExprs(names: CustomerNames): Record<string, SQL> {
  return {
    state: sql`coalesce(${address.stateCode}, '')`,
    city: sql`coalesce(${address.city}, '')`,
    payment_method: sql`coalesce(${order.paymentMethod}, '')`,
    channel: sql`coalesce(${order.attribution} ->> 'channel', '')`,
    source: sql`coalesce(${order.attribution} ->> 'source', '')`,
    discount_code: sql`coalesce(${order.discountCode}, '')`,
    customer_name: customerName(names),
  }
}

/** Placed, real orders that are not cancelled: what every sales number counts. */
const LIVE_ORDER = sql`${order.status} not in ('draft', 'cancelled') and ${notTestOrder}`

const ORDER_JOINS = sql`left join ${address} on ${address.id} = ${order.shippingAddressId}
  left join ${customer} on ${customer.id} = ${order.customerId}`

export function tableSql(table: QueryTable, names: CustomerNames): TableSql {
  if (table === 'sales') {
    return {
      exprs: {
        net_sales: sql`coalesce(sum(${order.subtotalPaise} - ${order.discountPaise}), 0)::bigint`,
        gross_sales: sql`coalesce(sum(${order.subtotalPaise}), 0)::bigint`,
        discounts: sql`coalesce(sum(${order.discountPaise}), 0)::bigint`,
        shipping: sql`coalesce(sum(${order.shippingPaise}), 0)::bigint`,
        taxes: sql`coalesce(sum(${order.taxPaise}), 0)::bigint`,
        total_sales: sql`coalesce(sum(${order.totalPaise}), 0)::bigint`,
        orders: sql`count(*)::int`,
        average_order_value: sql`coalesce(round(avg(${order.totalPaise})), 0)::bigint`,
        cod_orders: sql`(count(*) filter (where ${order.paymentMethod} = 'cod'))::int`,
        customers: sql`count(distinct ${order.customerId})::int`,
        ...calendar(sql`${order.placedAt}`),
        ...orderExprs(names),
        payment_status: sql`${order.paymentStatus}`,
        fulfillment_status: sql`${order.fulfillmentStatus}`,
      },
      filters: {
        product_title: (test) =>
          sql`exists (select 1 from ${orderLine} ol2 join ${variant} v2 on v2.id = ol2.variant_id
            join ${product} p2 on p2.id = v2.product_id
            where ol2.order_id = ${order.id} and ${test(sql`coalesce(p2.title, ol2.title, '')`)})`,
        sku: (test) =>
          sql`exists (select 1 from ${orderLine} ol2 join ${variant} v2 on v2.id = ol2.variant_id
            where ol2.order_id = ${order.id} and ${test(sql`coalesce(v2.sku, '')`)})`,
      },
      from: sql`${order} ${ORDER_JOINS}`,
      base: LIVE_ORDER,
      at: sql`${order.placedAt}`,
    }
  }
  if (table === 'products') {
    return {
      exprs: {
        net_quantity: sql`coalesce(sum(${NET_UNITS}), 0)::int`,
        ordered_quantity: sql`coalesce(sum(${orderLine.quantity}), 0)::int`,
        gross_sales: sql`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}), 0)::bigint`,
        cost: sql`coalesce(sum(${orderLine.quantity} * ${orderLine.costAtSalePaise}), 0)::bigint`,
        orders: sql`count(distinct ${order.id})::int`,
        customers: sql`count(distinct ${order.customerId})::int`,
        returned_quantity: sql`coalesce(sum(${RETURNED_UNITS}), 0)::int`,
        product_title: sql`coalesce(${product.title}, ${orderLine.title}, '')`,
        variant_title: sql`coalesce(${variant.title}, ${orderLine.variantTitle}, '')`,
        sku: sql`coalesce(${variant.sku}, '')`,
        vendor: sql`coalesce(${product.vendor}, '')`,
        product_type: sql`coalesce(${product.productType}, '')`,
        ...calendar(sql`${order.placedAt}`),
        ...orderExprs(names),
      },
      filters: {
        collection: (test) =>
          sql`exists (select 1 from ${collectionProduct} join ${collection} on ${collection.id} = ${collectionProduct.collectionId}
            where ${collectionProduct.productId} = ${product.id} and ${test(sql`${collection.title}`)})`,
        product_tag: (test) =>
          sql`exists (select 1 from unnest(${product.tags}) as tag(value) where ${test(sql`tag.value`)})`,
      },
      from: sql`${orderLine} join ${order} on ${order.id} = ${orderLine.orderId}
        join ${variant} on ${variant.id} = ${orderLine.variantId}
        join ${product} on ${product.id} = ${variant.productId}
        ${ORDER_JOINS}`,
      base: LIVE_ORDER,
      at: sql`${order.placedAt}`,
    }
  }
  return {
    exprs: {
      amount_refunded: sql`coalesce(sum(${refund.amountPaise}), 0)::bigint`,
      refunds: sql`count(*)::int`,
      orders: sql`count(distinct ${refund.orderId})::int`,
      ...calendar(sql`${refund.createdAt}`),
      refund_method: sql`coalesce(${refund.method}, 'gateway')`,
      reason: sql`coalesce(${refund.reason}, '')`,
      payment_method: sql`coalesce(${order.paymentMethod}, '')`,
      channel: sql`coalesce(${order.attribution} ->> 'channel', '')`,
    },
    filters: {},
    from: sql`${refund} join ${order} on ${order.id} = ${refund.orderId}`,
    // Money sent back on real orders, cancelled ones included: it left the store either way.
    base: sql`${refund.status} in ('processed', 'manual') and ${order.status} <> 'draft' and ${notTestOrder}`,
    at: sql`${refund.createdAt}`,
  }
}

/** A state typed by name ("Maharashtra") matches the code the address keeps ("MH"). */
function stateValue(v: string): string {
  const named = Object.entries(INDIAN_STATE_NAMES).find(
    ([, name]) => name.toLowerCase() === v.trim().toLowerCase(),
  )
  return named ? named[0] : v
}

const SQL_OP: Record<'=' | '<' | '<=' | '>' | '>=', SQL> = {
  '=': sql.raw('='),
  '<': sql.raw('<'),
  '<=': sql.raw('<='),
  '>': sql.raw('>'),
  '>=': sql.raw('>='),
}

/** One case-insensitive text test; every value is a bound parameter. */
function textTest(value: SQL, op: QueryOperator, values: string[]): SQL {
  const v = sql`lower(${values[0] ?? ''}::text)`
  const x = sql`lower(${value})`
  switch (op) {
    case 'in':
      return sql`${x} in (${sql.join(
        values.map((each) => sql`lower(${each}::text)`),
        sql`, `,
      )})`
    case 'contains':
      return sql`strpos(${x}, ${v}) > 0`
    case 'starts_with':
      return sql`starts_with(${x}, ${v})`
    case 'ends_with':
      return sql`right(${x}, char_length(${v})) = ${v}`
    case '!=':
      return sql`${x} <> ${v}`
    default:
      return sql`${x} ${SQL_OP[op]} ${v}`
  }
}

/** WHERE as SQL. `!=` on a filter-only field means "no row has it", like NOT … = …. */
export function whereSql(c: QueryCondition, t: TableSql, table: QueryTable): SQL {
  if (c.kind === 'not') return sql`(not ${whereSql(c.item, t, table)})`
  if (c.kind !== 'compare') {
    return sql`(${sql.join(
      c.items.map((i) => whereSql(i, t, table)),
      sql.raw(c.kind === 'and' ? ' and ' : ' or '),
    )})`
  }
  const values = c.values.map((v) => (c.field === 'state' ? stateValue(String(v)) : String(v)))
  const multi = t.filters[c.field]
  if (multi) {
    if (c.op === '!=') return sql`(not ${multi((value) => textTest(value, '=', values))})`
    return multi((value) => textTest(value, c.op, values))
  }
  const expr = t.exprs[c.field]
  if (!expr || fieldOf(table, c.field)?.role !== 'dimension') {
    throw new Error(`No SQL for WHERE field ${c.field}`)
  }
  return textTest(expr, c.op, values)
}

/** HAVING as SQL: a metric's total against a number, money typed in rupees. */
export function havingSql(c: QueryCondition, t: TableSql, table: QueryTable): SQL {
  if (c.kind === 'not') return sql`(not ${havingSql(c.item, t, table)})`
  if (c.kind !== 'compare') {
    return sql`(${sql.join(
      c.items.map((i) => havingSql(i, t, table)),
      sql.raw(c.kind === 'and' ? ' and ' : ' or '),
    )})`
  }
  const field = fieldOf(table, c.field)
  const expr = t.exprs[c.field]
  if (!expr || field?.role !== 'metric') throw new Error(`No SQL for HAVING field ${c.field}`)
  const n = Number(c.values[0])
  const value = field.type === 'money' ? Math.round(n * 100) : n
  const op = c.op === '!=' ? sql.raw('<>') : SQL_OP[c.op as keyof typeof SQL_OP]
  if (!op) throw new Error(`HAVING cannot use ${c.op}`)
  return sql`${expr} ${op} ${value}::numeric`
}
