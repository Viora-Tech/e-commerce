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
