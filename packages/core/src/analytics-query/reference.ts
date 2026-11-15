/** SOURCE OF TRUTH: custom analytics query reference — WHAT: the language described as text / WHY: "Refine with AI", the assistant and MCP clients learn the same vocabulary the parser reads */
import {
  QUERY_GROUP_MAX,
  QUERY_LIMIT_DEFAULT,
  QUERY_LIMIT_MAX,
  QUERY_PERIODS,
  QUERY_RANGE_MAX_YEARS,
  QUERY_TABLE_NAMES,
  QUERY_TABLES,
} from './schema'

/** Queries the reference shows the model, each with what it answers. */
export const QUERY_EXAMPLES: readonly { ask: string; query: string }[] = [
  {
    ask: 'how many Waizowl TRIAINA have we sold, all time',
    query:
      "FROM products\n  SHOW net_quantity, gross_sales, orders\n  WHERE product_title CONTAINS 'triaina'\n  DURING all_time",
  },
  {
    ask: 'TRIAINA units by variant, all time',
    query:
      "FROM products\n  SHOW net_quantity, gross_sales\n  WHERE product_title CONTAINS 'triaina'\n  GROUP BY product_title, variant_title\n  DURING all_time\n  ORDER BY net_quantity DESC",
  },
  {
    ask: 'sales of the TRIAINA last month vs the month before',
    query:
      "FROM products\n  SHOW net_quantity, gross_sales\n  WHERE product_title CONTAINS 'triaina'\n  DURING last_month\n  COMPARE TO previous_period",
  },
  {
    ask: 'sales by month this year compared with last year',
    query:
      'FROM sales\n  SHOW net_sales, orders\n  GROUP BY month\n  DURING this_year\n  COMPARE TO previous_year\n  ORDER BY month ASC',
  },
  {
    ask: 'top 5 states by sales last month',
    query:
      'FROM sales\n  SHOW net_sales, orders\n  GROUP BY state\n  DURING last_month\n  ORDER BY net_sales DESC\n  LIMIT 5',
  },
  {
    ask: 'orders from Instagram by channel in the last 90 days, COD only',
    query:
      "FROM sales\n  SHOW orders, total_sales\n  WHERE source = 'instagram' AND payment_method = 'cod'\n  GROUP BY channel\n  SINCE -90d UNTIL today",
  },
  {
    ask: 'top 10 customers by spend, all time, with at least 2 orders',
    query:
      'FROM sales\n  SHOW total_sales, orders\n  GROUP BY customer_name\n  HAVING orders >= 2\n  DURING all_time\n  ORDER BY total_sales DESC\n  LIMIT 10',
  },
  {
    ask: 'mice sold per month (Mice collection), Logitech or Waizowl vendors',
    query:
      "FROM products\n  SHOW net_quantity\n  WHERE collection = 'mice' AND vendor IN ('logitech', 'waizowl')\n  GROUP BY month\n  SINCE -12m UNTIL today\n  ORDER BY month ASC",
  },
  {
    ask: 'refunds by reason this financial year',
    query:
      'FROM refunds\n  SHOW amount_refunded, refunds\n  GROUP BY reason\n  DURING this_financial_year\n  ORDER BY amount_refunded DESC',
  },
  {
    ask: 'which discount codes brought the most sales in the last 6 months',
    query:
      "FROM sales\n  SHOW net_sales, discounts, orders\n  WHERE discount_code != ''\n  GROUP BY discount_code\n  SINCE -6m UNTIL today\n  ORDER BY net_sales DESC\n  LIMIT 20",
  },
  {
    ask: 'products with the most returns in 2025',
    query:
      'FROM products\n  SHOW returned_quantity, net_quantity\n  GROUP BY product_title\n  HAVING returned_quantity > 0\n  SINCE 2025-01-01 UNTIL 2025-12-31\n  ORDER BY returned_quantity DESC\n  LIMIT 10',
  },
]

/** The whole language as plain text: clauses, tables, fields and examples. */
export function queryLanguageReference(): string {
  const tables = QUERY_TABLE_NAMES.map((name) => {
    const t = QUERY_TABLES[name]
    const fields = t.fields.map((f) => {
      const role = f.role === 'metric' ? 'metric' : f.filterOnly ? 'filter only' : 'dimension'
      return `  - ${f.name} (${role}, ${f.type}): ${f.description}`
    })
    return [`Table ${name}: ${t.description}`, ...fields].join('\n')
  })
  return [
    'Query language (ShopifyQL-like; one clause per line, keywords in capitals):',
    'FROM <table>                     required, first',
    'SHOW <metric>, <metric>          required, one or more metrics of that table',
    "WHERE <condition>                optional, which rows count, e.g. product_title CONTAINS 'triaina'",
    `GROUP BY <dimension>, …          optional, up to ${QUERY_GROUP_MAX} dimensions; without it you get one total row`,
    'HAVING <metric> > <number>       optional, needs GROUP BY; keeps groups by their totals (money in rupees)',
    'SINCE <time> UNTIL <time>        optional, default SINCE -30d UNTIL today',
    `DURING <range>                   optional, instead of SINCE/UNTIL: ${QUERY_PERIODS.join(', ')}`,
    'COMPARE TO previous_period|previous_year   optional, adds the earlier numbers',
    'ORDER BY <field> ASC|DESC        optional, a field the query shows or groups by',
    `LIMIT <n>                        optional, 1 to ${QUERY_LIMIT_MAX}, default ${QUERY_LIMIT_DEFAULT}`,
    "Conditions: field = 'text', field != 'text', <, <=, >, >=, field IN ('a', 'b'), field CONTAINS 'text', STARTS WITH, ENDS WITH; NOT before any of them (field NOT IN (…), NOT field = 'x'); join with AND / OR and brackets.",
    'Text values go in single quotes and match without caring about case. For a product the merchant names, use product_title CONTAINS with the most distinctive word of its name (the model name), not the whole title.',
    'A time is -30d (days ago), -4w (weeks), -3m (months), -2y (years), today, yesterday or a date like 2026-10-01.',
    `"All time" or "ever" is DURING all_time (from the store's first order). "Last month" is DURING last_month (the calendar month); "this month" is DURING this_month. A range covers at most ${QUERY_RANGE_MAX_YEARS} years and is never cut short: a longer one is refused.`,
    'Dates are India time. Cancelled, draft and test orders are never counted.',
    'There are no joins, functions or other clauses.',
    '',
    ...tables,
    '',
    'Examples:',
    ...QUERY_EXAMPLES.map((e) => `"${e.ask}":\n${e.query}`),
  ].join('\n')
}
