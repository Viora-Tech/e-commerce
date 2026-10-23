/** SOURCE OF TRUTH: custom analytics query reference — WHAT: the language described as text / WHY: "Refine with AI" teaches the model the same vocabulary the parser reads */
import { QUERY_LIMIT_DEFAULT, QUERY_LIMIT_MAX, QUERY_TABLE_NAMES, QUERY_TABLES } from './schema'

/** Queries the reference shows the model, each with what it answers. */
export const QUERY_EXAMPLES: readonly { ask: string; query: string }[] = [
  {
    ask: 'top 5 states by sales last month',
    query:
      'FROM sales\n  SHOW net_sales, orders\n  GROUP BY state\n  SINCE -1m UNTIL today\n  ORDER BY net_sales DESC\n  LIMIT 5',
  },
  {
    ask: 'daily orders this week compared with the week before',
    query:
      'FROM sales\n  SHOW orders\n  GROUP BY day\n  SINCE -7d UNTIL today\n  COMPARE TO previous_period\n  ORDER BY day ASC\n  LIMIT 100',
  },
  {
    ask: 'best selling products in the last 90 days',
    query:
      'FROM products\n  SHOW net_quantity, gross_sales\n  GROUP BY product_title\n  SINCE -90d UNTIL today\n  ORDER BY net_quantity DESC\n  LIMIT 10',
  },
  {
    ask: 'total sales in September 2026',
    query: 'FROM sales\n  SHOW net_sales, total_sales, orders\n  SINCE 2026-09-01 UNTIL 2026-09-30',
  },
]

/** The whole language as plain text: clauses, tables, fields and examples. */
export function queryLanguageReference(): string {
  const tables = QUERY_TABLE_NAMES.map((name) => {
    const t = QUERY_TABLES[name]
    const fields = t.fields.map(
      (f) =>
        `  - ${f.name} (${f.role === 'metric' ? 'metric' : 'dimension'}, ${f.type}): ${f.description}`,
    )
    return [`Table ${name}: ${t.description}`, ...fields].join('\n')
  })
  return [
    'Query language (one clause per line, keywords in capitals):',
    'FROM <table>                     required, first',
    'SHOW <metric>, <metric>          required, one or more metrics of that table',
    'GROUP BY <dimension>             optional, one dimension of that table',
    'SINCE <time> UNTIL <time>        optional, default SINCE -30d UNTIL today',
    'COMPARE TO previous_period|previous_year   optional',
    'ORDER BY <field> ASC|DESC        optional, a field the query shows or groups by',
    `LIMIT <n>                        optional, 1 to ${QUERY_LIMIT_MAX}, default ${QUERY_LIMIT_DEFAULT}`,
    'A time is -30d (days ago), -4w (weeks), -3m (months), today, yesterday or a date like 2026-10-01.',
    'There is no WHERE, no joins, no functions, nothing else.',
    '',
    ...tables,
    '',
    'Examples:',
    ...QUERY_EXAMPLES.map((e) => `"${e.ask}":\n${e.query}`),
  ].join('\n')
}
