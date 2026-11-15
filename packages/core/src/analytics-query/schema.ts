/** SOURCE OF TRUTH: custom analytics query schema — WHAT: tables, fields and operators a query can read / WHY: every field maps to one fixed SQL expression */
/**
 * What a custom analytics query can read (Figma "Analytics · Report — query editor", "Data you
 * can query"). Every field here maps to one fixed SQL expression on the server; nothing a
 * merchant types ever reaches SQL except as a bound value. Tables are listed only when they run.
 */

export type QueryFieldType = 'money' | 'number' | 'text' | 'date' | 'month' | 'state' | 'payment'

export type QueryField = {
  name: string
  type: QueryFieldType
  /** `metric`: added up (SHOW, HAVING). `dimension`: rows are split by it (GROUP BY, WHERE). */
  role: 'metric' | 'dimension'
  description: string
  /** A dimension that only filters (WHERE), because one row can have many (collections, tags). */
  filterOnly?: boolean
}

const metric = (name: string, type: QueryFieldType, description: string): QueryField => ({
  name,
  type,
  role: 'metric',
  description,
})
const dim = (name: string, type: QueryFieldType, description: string): QueryField => ({
  name,
  type,
  role: 'dimension',
  description,
})
const filter = (name: string, description: string): QueryField => ({
  name,
  type: 'text',
  role: 'dimension',
  description,
  filterOnly: true,
})

/** Calendar buckets every table has, on the date its rows count from. */
const calendar = (what: string): QueryField[] => [
  dim('day', 'date', `IST day ${what}`),
  dim('week', 'date', `IST week ${what} (its Monday)`),
  dim('month', 'month', `IST month ${what}`),
  dim('year', 'text', `IST year ${what}`),
]

/** What an order carries, for the tables built on orders. */
const orderDims: QueryField[] = [
  dim('state', 'state', 'ship-to state (code like MH, or the name)'),
  dim('city', 'text', 'ship-to city'),
  dim('payment_method', 'payment', 'how paid: cod, razorpay, upi, manual, …'),
  dim(
    'channel',
    'text',
    'where the visit came from: direct, social, paid_social, organic_search, …',
  ),
  dim('source', 'text', 'utm source of the visit: instagram, google, facebook, …'),
  dim('discount_code', 'text', 'discount code used, empty when none'),
  dim('customer_name', 'text', 'the customer’s name'),
]

export const QUERY_TABLES = {
  sales: {
    description:
      'One row per placed order, dated when placed (drafts, test and cancelled orders left out).',
    fields: [
      metric('net_sales', 'money', 'after discounts, before shipping and tax'),
      metric('gross_sales', 'money', 'before discounts'),
      metric('discounts', 'money', 'discounts given'),
      metric('shipping', 'money', 'shipping charged'),
      metric('taxes', 'money', 'GST on the orders'),
      metric('total_sales', 'money', 'what shoppers paid'),
      metric('orders', 'number', 'orders placed'),
      metric('average_order_value', 'money', 'total sales ÷ orders'),
      metric('cod_orders', 'number', 'cash on delivery orders'),
      metric('customers', 'number', 'different customers who ordered'),
      ...calendar('placed'),
      ...orderDims,
      dim('payment_status', 'text', 'paid, unpaid, partially_refunded, refunded, …'),
      dim('fulfillment_status', 'text', 'unfulfilled, shipped, delivered, returned, …'),
      filter('product_title', 'orders with a line of this product'),
      filter('sku', 'orders with a line of this SKU'),
    ],
  },
  products: {
    description:
      'One row per order line, dated when the order was placed (drafts, test and cancelled orders left out).',
    fields: [
      metric('net_quantity', 'number', 'units sold: ordered minus returned'),
      metric('ordered_quantity', 'number', 'units ordered, before returns'),
      metric('gross_sales', 'money', 'units × price'),
      metric('cost', 'money', 'cost at sale, when known'),
      metric('orders', 'number', 'orders it was in'),
      metric('customers', 'number', 'different customers who bought it'),
      metric('returned_quantity', 'number', 'units sent back (returns and RTO not rejected)'),
      dim('product_title', 'text', 'product name (today’s)'),
      dim('variant_title', 'text', 'variant name, e.g. Black / Wireless'),
      dim('sku', 'text', 'variant SKU'),
      dim('vendor', 'text', 'product vendor / brand'),
      dim('product_type', 'text', 'product type'),
      ...calendar('placed'),
      ...orderDims,
      filter('collection', 'products in this collection (title)'),
      filter('product_tag', 'products with this tag'),
    ],
  },
  refunds: {
    description:
      'One row per refund sent back (processed or recorded by hand), dated when refunded (test orders left out).',
    fields: [
      metric('amount_refunded', 'money', 'money sent back'),
      metric('refunds', 'number', 'refunds made'),
      metric('orders', 'number', 'orders refunded'),
      ...calendar('refunded'),
      dim(
        'refund_method',
        'text',
        'how it went back: gateway (online), upi, bank_transfer, cash, store_credit, …',
      ),
      dim('reason', 'text', 'reason given'),
      dim('payment_method', 'payment', 'how the order was paid'),
      dim('channel', 'text', 'where the order’s visit came from'),
    ],
  },
} as const satisfies Record<string, { description: string; fields: readonly QueryField[] }>

export type QueryTable = keyof typeof QUERY_TABLES
export const QUERY_TABLE_NAMES = Object.keys(QUERY_TABLES) as QueryTable[]

export const fieldsOf = (table: QueryTable): readonly QueryField[] => QUERY_TABLES[table].fields

export const fieldOf = (table: QueryTable, name: string): QueryField | undefined =>
  fieldsOf(table).find((f) => f.name === name)

export const COMPARE_OPTIONS = ['previous_period', 'previous_year'] as const
export type QueryCompare = (typeof COMPARE_OPTIONS)[number]

/** Time words SINCE / UNTIL accept besides `-30d`, `-4w`, `-3m`, `-2y` and `2026-10-01`. */
export const TIME_WORDS = ['today', 'yesterday'] as const

/** Named ranges for DURING, Shopify-style; weeks start on Monday, financial years in April. */
export const QUERY_PERIODS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'this_financial_year',
  'last_financial_year',
  'all_time',
] as const
export type QueryPeriod = (typeof QUERY_PERIODS)[number]

export const QUERY_KEYWORDS = [
  'FROM',
  'SHOW',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'SINCE',
  'UNTIL',
  'DURING',
  'COMPARE TO',
  'ORDER BY',
  'LIMIT',
] as const

/** Words inside WHERE and HAVING. */
export const CONDITION_WORDS = [
  'AND',
  'OR',
  'NOT',
  'IN',
  'CONTAINS',
  'STARTS WITH',
  'ENDS WITH',
] as const

export const QUERY_LIMIT_MAX = 1000
export const QUERY_LIMIT_DEFAULT = 100
/** Longest range a query may cover; a longer one is refused, never cut short. */
export const QUERY_RANGE_MAX_YEARS = 20
/** GROUP BY takes up to this many fields. */
export const QUERY_GROUP_MAX = 3

/** The query a new custom report starts from. */
export const STARTER_QUERY = `FROM sales
  SHOW net_sales, orders, average_order_value
  GROUP BY state
  SINCE -30d UNTIL today
  COMPARE TO previous_period
  ORDER BY net_sales DESC
  LIMIT 10`
