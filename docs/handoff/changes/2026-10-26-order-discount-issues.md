# Discount codes on draft orders, Duplicate order, discount usage tracking

Branch `fix/order-discount-issues-2026-10-26`. Fixes #795, #674, #673. **No migration.**

## #795 Discount code on a draft order

- Draft editor Payment card (`components/drafts/draft-totals-card.tsx`) has a "Discount code"
  field (`draft-discount-code.tsx`): Apply checks it, the applied code shows as a removable
  chip with its label and amount (or "Free shipping"), and a refusal shows the reason.
- The check is checkout's: `checkDraftDiscountCode` (`packages/core/src/order/draft-discount.ts`)
  feeds the draft's lines (with collections) to the same `checkCodeOn` → `evaluateDiscount` the
  cart uses (`discounts/resolve.ts`; `checkDiscountCode` now calls `checkCodeOn` too). Dates,
  status, min subtotal/quantity, product/collection scope, customer eligibility and the
  per-customer cap (draft email) all apply. A draft with a gift card line takes no code, as at checkout.
- `useDraftCodeCheck` re-checks a moment after lines, email, address or shipping change, so the
  card shows what Save will apply. Route: `orders.checkDraftDiscount` (`drafts.write`), nothing saved.
- `DraftInputSchema.discountCode`: on every save `draftMoney` re-checks the code server side and
  writes `order.discount_id / discount_code / discount_label / discount_paise` (a free-shipping
  code zeroes `shipping_paise` via `applyDiscount`). A code that stopped applying refuses the save
  (`DRAFT_DISCOUNT_REJECTED`, message names the reason).
- **Code vs manual discount: mutually exclusive.** The manual amount is not a discount rule, so the
  combinations model cannot weigh it; applying a code clears and hides the manual fields.
- `convertDraft` counts a use (`recordDiscountUse`, new in `discounts/usage.ts`, same row lock and
  limits as checkout) and writes the `discount_usage` row, so limits, per-customer caps and the
  usage figures include draft orders. Out of uses → `DiscountUnavailable` → "remove the code" message.
  This covers the admin convert, the invoice pay link and billing drafts (all go through `convertDraft`).
- `discount_usage.email` is now stored lower-cased (checkout too), matching how
  `customerUsageCount` reads it; mixed-case emails previously escaped the per-customer cap.

## #674 Duplicate order

- `duplicateOrderAsDraft` (`packages/core/src/order/duplicate.ts`), route `orders.duplicateOrder`
  (`drafts.write`). Creates a **draft** (never a placed order): same customer, email, phone,
  shipping address (new address row), lines at today's catalogue price, shipping charge and rate
  name, shopper note, GSTIN, and the draft note. Lines whose product is archived are skipped, named
  in the draft's note ("Not copied (no longer available): …") and counted in the toast.
  No discount is carried over (re-enter the code; it is checked again). Payment method: COD kept,
  anything else falls back to the editor default.
- UI: "Duplicate order" in the order page's More actions (hidden on imported read-only orders) and
  the orders list row menu; both hidden without `drafts.write` (`use-duplicate-order.ts`). Opens the new draft.

## #673 Discount usage

- `discount.service.ts` `usageOf`: per discount, from `discount_usage` joined to `order` (test
  orders excluded): times used, revenue (order totals, cancelled excluded), discount given
  (cancelled excluded), last used. On `discounts.list` items (`usage`) and `discounts.get`
  (`usage` + `recent`: last 10 orders, number/status/total/amount/date, no customer PII since
  the discounts permission may not include customers).
- Discounts list: new Revenue, Discount given, Last used columns. Discount page: "Usage" card at
  the top of the main column with the four figures and recent orders linking to each order
  (`components/discounts/usage-stats-card.tsx`).
- No index added: `discount_usage` is small per store and the list query groups only the page's ids.
  Add `discount_usage(discount_id)` if a store's usage table grows large.

## Also: discount dates in the store's zone

`components/discounts/form-state.ts` `toLocalInput` / `fromLocalInput` now read and write the
`datetime-local` value as Asia/Kolkata wall time (`@commerce/dates` `wallClock` /
`zoneOffsetMs`), not the runtime zone (the server is UTC, so times shifted by 5:30). The summary
card parses with the same helper. Test `form-state.test.ts` runs under TZ=UTC and TZ=Asia/Kolkata.
`components/blog/form-state.ts` has the same pattern and was not changed.

## Tests

Core: `src/order/draft-discount.test.ts` (8). API: `test/discounts.test.ts` asserts the new usage
fields. Admin: `components/discounts/form-state.test.ts`.
