# Analytics: net_quantity is ordered minus returned

Owner decision, 15 Nov 2026: the query language's `net_quantity` subtracts returned units, like
Shopify's "Net quantity". Branch `fix/net-quantity-minus-returns`.

- `packages/api/src/services/analytics-query-sql.ts`: `net_quantity` on `products` is
  `sum(quantity − least(returned, quantity))` per line (`NET_UNITS`, exported). New metric
  `ordered_quantity` keeps the old number (units on non-cancelled orders, before returns).
  `returned_quantity` is unchanged.
- "Returned" is the definition `returned_quantity` already used: return or RTO lines whose return
  request is not `rejected` or `cancelled` (so `requested`, `approved`, `in_transit`, `received`
  and `resolved` all count). Not the restocked count the fixed "Returns by product" report uses.
- Attribution: by the order's date. The `products` table is one row per order line dated by
  `order.placed_at`, and returns were already summed per line, so they land on the order's date
  (Shopify's sales-by-order-date view). A month's figure can drop when a later return arrives.
- Cancelled, draft and test orders stay out (their returns too).
- `packages/core/src/analytics-query/schema.ts` and `reference.ts`: field descriptions, a line in
  `queryLanguageReference()` saying "units sold" is `net_quantity`, and the returns example shows
  all three numbers.
- AI `topProducts` (`services/ai/store-tools.ts`) ranks and shows net units, so its table matches
  the `net_quantity` query it offers to open as a report. Gross sales there stay units × price
  ordered, as the query's `gross_sales` does.
- Not changed (they say "units" / "sold", never "net", and count units ordered): the fixed reports
  (Sales by product/variant/vendor), dashboard and home Top products, the product page's "Sales
  past 90 days" card, the restock best-seller card. Owner to decide whether those move to net.
- Merchant guide: `analytics/reports.mdx` explains the three unit numbers.
- Test: `packages/api/test/analytics-query.test.ts` "net_quantity is ordered minus returned…"
  (3 ordered, 1 received return → net 2; rejected return and a cancelled order's return ignored;
  the return lands in the order's month).
