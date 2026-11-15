# Units sold are ordered minus returned, everywhere

Owner decisions, 15 Nov 2026: the query language's `net_quantity` subtracts returned units, like
Shopify's "Net quantity", and then every "units sold" number does the same so they all match.
Branch `fix/net-quantity-minus-returns` (PR #1727).

## One definition

- `packages/core/src/order/net-units.ts` (exported from `@commerce/core`): `RETURNED_UNITS` and
  `NET_UNITS`, SQL on an `order_line` row. Net = `quantity − least(returned, quantity)`, never
  below zero per line.
- "Returned": return or RTO lines whose return request is not `rejected` or `cancelled` (so
  `requested`, `approved`, `in_transit`, `received` and `resolved` all count), the rule
  `returned_quantity` already used. Not the restocked count of the "Returns by product" report,
  which is unchanged.
- Attribution: by the order's date. Every one of these numbers dates a line by `order.placed_at`,
  so a return lands on its order's date (Shopify's sales-by-order-date view); a past period's
  figure can drop when a later return arrives.
- Cancelled, draft and test orders stay out, as before. Gross sales / revenue stay units × price
  ordered everywhere; only the unit counts are net.

## Where

- Custom query (`services/analytics-query-sql.ts`): `net_quantity` is net; new `ordered_quantity`
  keeps the old number; `returned_quantity` unchanged. `schema.ts` / `reference.ts` wording, and
  `queryLanguageReference()` says "units sold" is `net_quantity`.
- AI `topProducts` (`services/ai/store-tools.ts`): ranks and shows net units.
- Fixed reports Sales by product / variant / vendor / product type (`reports/sales.ts`): the
  column is now `unitsSold`, labelled "Units sold" ("बिके यूनिट"), from `LineFact.netUnits`.
  `LineFact.quantity` stays units ordered for the stock reports that read it (sell-through, days
  of cover, ABC, Returns by product), which are not "units sold" columns.
- Dashboard Top products (`dashboard.service.ts`, summary and charts), Analytics Top products
  (`analytics.service.ts`), Home's units tile and best seller (`home-analytics.service.ts`).
- Product page "Sales past 90 days" (`product-sales.service.ts` / `product-sales.ts`): `units`
  is net (`ProductSaleLine.netUnits`); gross stays ordered.
- Restock best-seller card (`core/home-cards/service.ts`, `salesBetween`): `unitsSold` and the
  ranking are net, so a product needs five net sales to count as a best seller.
- Merchant guide `analytics/reports.mdx` explains the three unit numbers.
- Not changed on purpose: Returns by product (units restocked), Profit by product (its own
  "not put back in stock" rule), Orders over time units, stock reports. The legacy parity copies
  in `packages/api/test/support/legacy/` stay as they were; the parity seed has no returns.

## Tests

- `packages/api/test/analytics-query.test.ts`: 3 ordered, 1 received return → net 2; rejected
  return and a cancelled order's return ignored; the return lands in the order's month.
- `packages/api/test/analytics.test.ts`: Sales by product / variant / vendor / type show
  `unitsSold` net of a returned unit; sell-through still counts units ordered.
- `packages/api/test/units-sold-net.test.ts`: dashboard summary and charts, Analytics, Home tile
  and best seller, product page card all show 4 for 6 ordered with 2 returned (and a rejected
  return ignored); the restock card stays off at 4 net and turns on at 6 once the return is
  cancelled.
- `packages/api/test/product-sales.test.ts`: units net, gross ordered.
