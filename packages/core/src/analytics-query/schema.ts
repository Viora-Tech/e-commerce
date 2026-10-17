/**
 * What a custom analytics query can read (Figma "Analytics · Report — query editor", "Data you
 * can query"). Every field here maps to one fixed SQL expression on the server; nothing a
 * merchant types ever reaches SQL. Tables are listed only when they actually run.
 */

export type QueryFieldType = 'money' | 'number' | 'text' | 'date' | 'month' | 'state' | 'payment'

export type QueryField = {
  name: string
  type: QueryFieldType
  /** `metric`: added up (SHOW). `dimension`: rows are split by it (GROUP BY). */
  role: 'metric' | 'dimension'
  description: string
}

export const QUERY_TABLES = {
  sales: {
    description: 'One row per placed order (drafts and cancelled orders left out).',
    fields: [
      { name: 'net_sales', type: 'money', role: 'metric', description: 'after discounts' },
      { name: 'gross_sales', type: 'money', role: 'metric', description: 'before discounts' },
      { name: 'discounts', type: 'money', role: 'metric', description: 'discounts given' },
      { name: 'shipping', type: 'money', role: 'metric', description: 'shipping charged' },
      { name: 'taxes', type: 'money', role: 'metric', description: 'GST on the orders' },
      { name: 'total_sales', type: 'money', role: 'metric', description: 'what shoppers paid' },
      { name: 'orders', type: 'number', role: 'metric', description: 'orders placed' },
      {
        name: 'average_order_value',
        type: 'money',
        role: 'metric',
        description: 'total sales ÷ orders',
      },
      { name: 'cod_orders', type: 'number', role: 'metric', description: 'cash on delivery' },
      { name: 'day', type: 'date', role: 'dimension', description: 'IST day placed' },
      { name: 'month', type: 'month', role: 'dimension', description: 'IST month placed' },
      { name: 'state', type: 'state', role: 'dimension', description: 'ship-to state' },
      { name: 'payment_method', type: 'payment', role: 'dimension', description: 'how paid' },
      {
        name: 'channel',
        type: 'text',
        role: 'dimension',
        description: 'where the visit came from',
      },
    ],
  },
  products: {
    description: 'One row per order line, for what sold.',
    fields: [
      { name: 'net_quantity', type: 'number', role: 'metric', description: 'units sold' },
      { name: 'gross_sales', type: 'money', role: 'metric', description: 'units × price' },
      { name: 'cost', type: 'money', role: 'metric', description: 'cost at sale, when known' },
      { name: 'orders', type: 'number', role: 'metric', description: 'orders it was in' },
      { name: 'product_title', type: 'text', role: 'dimension', description: 'product name' },
      { name: 'variant_title', type: 'text', role: 'dimension', description: 'variant name' },
      { name: 'day', type: 'date', role: 'dimension', description: 'IST day placed' },
      { name: 'month', type: 'month', role: 'dimension', description: 'IST month placed' },
      { name: 'state', type: 'state', role: 'dimension', description: 'ship-to state' },
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

/** Time words SINCE / UNTIL accept besides `-30d`, `-4w`, `-3m` and `2026-10-01`. */
export const TIME_WORDS = ['today', 'yesterday'] as const

export const QUERY_KEYWORDS = [
  'FROM',
  'SHOW',
  'GROUP BY',
  'SINCE',
  'UNTIL',
  'COMPARE TO',
  'ORDER BY',
  'LIMIT',
] as const

export const QUERY_LIMIT_MAX = 1000
export const QUERY_LIMIT_DEFAULT = 100

/** The query a new custom report starts from. */
export const STARTER_QUERY = `FROM sales
  SHOW net_sales, orders, average_order_value
  GROUP BY state
  SINCE -30d UNTIL today
  COMPARE TO previous_period
  ORDER BY net_sales DESC
  LIMIT 10`
