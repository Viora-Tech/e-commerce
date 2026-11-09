# Home and Analytics total their orders in SQL; Home stops rebuilding smart cards

`dashboard.summary`, `dashboard.charts`, `dashboard.analytics` (Home) and `analytics.overview`
(the Analytics page) loaded every order of their windows (14, 30, 90 days, up to a year and its
comparison year), every order line and every sellable variant into JavaScript and added them up
there. They now group in Postgres (by IST day, IST hour, window, payment method) and read back a
few hundred rows at most, whatever the store's size. Their independent reads go out together on
the request's transaction (postgres.js pipelines them), instead of one after another.

- New `packages/api/src/services/sql-buckets.ts`: SQL twins of the JS bucket helpers
  (`stepIndex` = `Math.floor((at - from) / unit)`, `istHourSql`, `istWeekdaySql`, `istDaySql`).
  Bucket bounds are inlined literals, not parameters: Postgres only accepts a selected and grouped
  expression when both are the same text, and drizzle numbers every parameter on its own.
- The stock series (in stock / out of stock at the end of each of the 14 days) is rebuilt in SQL
  from today's sellable levels and the adjustment log, as `stockByDay` did.
- "Returning" compares each order with its customer's first counted order at millisecond
  precision, the same as the JS `Date` comparison.
- Numbers are unchanged; cancelled orders stay out of orders and sales (the Waimers rule).
  `packages/api/test/dashboard-sql-parity.test.ts` seeds a year of mixed orders (cancelled,
  drafts, test orders, unfinished checkouts, imported, refunds, carts, stock changes) and checks
  every figure against the old code, kept unchanged in `packages/api/test/support/legacy/`, at
  three moments (mid-month, just after IST midnight, the first of a month). The only ordering
  change: payment methods with equal counts now sort by name (it was whatever order rows came in).
- Smart cards: `listHomeCards` only reads. It used to rebuild every card (a dozen heavy queries)
  inside the Home request when the last run was 26 hours old. The worker's hourly `home-cards`
  sweep already rebuilds every store with products whose cards are 20 hours old or missing, so a
  new store waits at most an hour for its first cards.
- No migration, no new env keys.
