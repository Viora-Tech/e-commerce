# Analytics query: WHERE, full history, and the AI answers numbers with it

Branch `feat/analytics-query-sidekick`. No migration. The owner asked Ask AI "how many Waizowl
TRIAINA mice have we sold?" and it could not answer; he rejected a one-off tool and asked for
Shopify Sidekick's approach: the AI writes a ShopifyQL-like query and shows the number, the table
and the query. Open-source radar has no query-language candidate (Umami / PostHog / Plausible are
event analytics, not a store query language), so the in-house language was extended.

## The language (`packages/core/src/analytics-query/`)

- **WHERE** (`condition.ts`): `=`, `!=` (`<>`), `<`, `<=`, `>`, `>=`, `IN (…)`, `CONTAINS`,
  `STARTS WITH`, `ENDS WITH`, `NOT` (prefix, or `NOT IN` / `NOT CONTAINS` …), `AND` / `OR`,
  brackets. Text in single or double quotes (`''` escapes), compared case-insensitively. Checked
  against the table's dimensions with "Did you mean"; a metric in WHERE points to HAVING. Caps:
  20 comparisons, 50 IN values, 8 bracket levels, 200 characters a value.
- **Filter-only fields** (`filterOnly`): `products.collection`, `products.product_tag`,
  `sales.product_title`, `sales.sku` (orders containing it). They filter (EXISTS) but never group.
- **GROUP BY** takes up to three fields (`ParsedQuery.groupBy` is now `string[]`); the Dimension
  control edits the first.
- **HAVING** on metrics with numbers (money in rupees), needs GROUP BY.
- **DURING** `today … last_financial_year, all_time` (`period.ts`); weeks start Monday, quarters
  are calendar, financial years April to March. SINCE/UNTIL also take `-Ny`.
- **Ranges are never cut short.** The old 365-day clamp (`resolveRange`'s `MAX_CUSTOM_DAYS`,
  still used by the fixed reports) no longer applies to custom queries. Over 20 years
  (`QUERY_RANGE_MAX_YEARS`) or SINCE after UNTIL is an error; `DURING all_time` starts at the
  store's first counted order. `result.range.days` is only listed up to 400 days.
- **New fields:** sales `customers`, `week`, `year`, `city`, `source`, `discount_code`,
  `customer_name`, `payment_status`, `fulfillment_status`; products `customers`,
  `returned_quantity`, `sku`, `vendor`, `product_type`, order dimensions; new **`refunds`** table
  (`amount_refunded`, `refunds`, `orders` by refund date, method, reason, payment method, channel).
  `products.product_title` / `variant_title` are now today's names (the line snapshot only when
  missing), so renamed products add up.

## Server (`packages/api/src/services/analytics-query*.ts`)

`analytics-query-sql.ts` holds one fixed SQL expression per field and compiles WHERE / HAVING with
bound parameters only (`strpos` / `starts_with`, no LIKE, so `%` and `_` are plain text). A state
typed by name matches its code. The query runs as one `sql` statement in the RLS transaction with
`set local statement_timeout = '15s'`. `runCustomQuery(tx, source, { now, customerNames })` also
returns the formatted `query` and the `days` covered. Customer names: full for members with
`customers.read`, refused otherwise; the AI gets first names only (listed in `shared`).

## AI

- New read tool **`analyticsQuery`** (`services/ai/query-tool.ts`, permission analytics.read),
  in the admin assistant and the MCP. Its description carries `queryLanguageReference()` (worked
  examples include "TRIAINA all time" and "last month vs previous"). Facts: the query, the dates
  covered, totals, up to 25 rows; a parse problem comes back as a fact so the model retries.
- Prompt: `QUERY_LINES` in `packages/ai/src/assistant/prompt.ts` sends every numbers / history /
  trend question there; MCP server instructions say the same; `topProducts` points to it; the
  Refine-with-AI writer uses DURING and product filters. Mock planner answers "how many X sold".
- Admin: the answer card shows "Query used" under the table; "Show query" shows it whole; headers
  of query fields read as words. Query editor: highlighting for strings and the new keywords,
  help popover lists WHERE / HAVING / DURING (en + hi).

Docs: merchant guide Analytics → Reports "Custom query"; developer docs AI assistant
"Numbers questions". Tests: `packages/core/src/analytics-query/where.test.ts`,
`packages/api/test/analytics-query.test.ts`.

## Left

- Totals of a grouped query ignore HAVING (they cover every row WHERE keeps).
- `net_quantity` is units ordered (cancelled orders out), not minus returns; `returned_quantity`
  is separate. Change only with the owner (Shopify's net quantity subtracts returns).
