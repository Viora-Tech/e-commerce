# Discounts list and Markets pages (admin audit #109, #110, #112, #117, #118)

## Discounts list

- **#109** Each discount's title cell has a one-line summary under it, like Shopify's list:
  "₹200 off on 18 products • Minimum purchase of ₹999.00 • One use per customer". Combo deals
  read "3 combos". Built by `discountListSummary` in
  `apps/admin/src/components/discounts/discount-list-summary.ts` (tests beside it) on top of
  `describeDiscountValue`. `listDiscounts` now also returns the counts and limits it needs
  (`appliesToCount`, minimums, `bxgy`, shipping states and cap, eligibility and its count,
  `combinesWith`, `usagePerCustomer`).
- **#110** Eligibility and Combinations columns, hidden by default (`DISCOUNT_HIDDEN_COLUMNS`);
  turn them on from the View menu. There is no "first-time buyers" eligibility in the schema
  yet, so the column shows all customers / N segments / N customers.
- **#112** The tiles' notes say "Running now", "Start later" and "Ended" instead of "Right now".

## Markets

- **#118** Add market opens a full page, `/markets/new` (`components/markets/new-market-page.tsx`),
  instead of the small dialog. Name and countries first, then every setting the market inherits
  (currency and prices, catalog, discounts, domain, languages, taxes and duties, shipping), each
  with a "Store default" or "Changed" chip. A row opens its part in a dialog built from the
  market dialog's own fields (`new-market-part-dialog.tsx`); nothing is saved until Create market.
  A picked catalog is attached right after creation via `catalogs.update` (its markets plus the
  new one). Discounts and shipping are shown, not changed here (a discount picks its markets on
  its own page; rates live in Shipping settings). `MarketDialog` stays for the market page rows.
- **#117** List / Graph switch on the Markets page. Graph (`markets-graph.tsx`): a Store
  defaults card (domain, language, products, currency, active discounts, business entity,
  checkout, GST, return rules) with an SVG curve to each market's card; each card lists only what
  it overrides (`market-overrides.ts`: currency, catalog, domain, languages, price adjustment) and
  opens the market. On a phone the cards stack under the defaults on a rail. The defaults are read
  by `app/(admin)/markets/load.ts`; each read is permission-checked on its own and shows less
  (null) when the member cannot see it.

## Test

- Discounts: open Discounts; each title has the summary line. View menu → turn on Eligibility and
  Combinations. Tiles read Running now / Start later / Ended.
- Markets: Add market → the New market page; change currency, catalog, domain, languages; each
  row flips to Changed; Create market lands on the market page (catalog set if picked). Markets →
  Graph: defaults card with a line to each market; resize to phone width, the cards stack.
- Unit tests: `discount-list-summary.test.ts`, `market-overrides.test.ts`.
