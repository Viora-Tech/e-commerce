# International checkout address, first-time buyer discounts (31 Oct 2026)

Branch `agent/intl-checkout`, pushed to `dev` part by part. Not run here (owner rule): tsc,
vitest, lint, builds. Run them on `dev`.

## First-time buyers only (discount eligibility)

- No migration: `discount.customer_eligibility` is plain text. `DiscountEligibility`
  (`@commerce/db`) and `DiscountEligibilitySchema` gain `first_time`; it needs no picked ids
  (only `segments` / `customers` keep `eligible_ids`; the service and the Shopify importer store
  `[]` for the others).
- Rule (`discounts/eligibility.ts` `firstOrderFor`, queried only when a rule asks): the shopper
  is a first-time buyer when no order matches their email (`order.email`, or the customer with
  that email) or phone (`orderPhoneForms`: ten digits, 91, +91, 0 spellings; a number abroad
  in E.164 only) that is not a draft, not cancelled, not a test, and not `unpaid`. An unpaid
  COD order does not count yet, as the rule is "no earlier paid order"; a per-customer limit
  covers a second code use before the first is paid.
- Evaluator: `DiscountContext.firstOrder` (undefined = not known yet, let through like the other
  eligibility checks on the cart page); refusal `not_first_order` → code rejection
  `first_order_only`. `placeOrder` passes the checkout phone (`DiscountShopper.phone`).
- Messages: storefront `discountFieldContent.errors.first_order_only`, admin drafts
  `code.rejected.first_order_only` (+ Hindi), `draft-discount.ts` text.
- Admin: Eligibility card radio "First-time buyers only" with help; Summary card "For
  first-time buyers"; list Eligibility column and summary line "First-time buyers".
- AI: the `proposeDiscount` action takes `firstTimeOnly`.
- Tests: `packages/core/src/discounts/first-time.test.ts`, `discount-list-summary.test.ts`.
