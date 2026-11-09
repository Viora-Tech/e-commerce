# Checkout drafts, part 1: schema and switch

First PR of "unpaid checkouts as drafts" (`docs/design/unpaid-checkouts-as-drafts.md`). Nothing
changes for shoppers or merchants yet: the switch is off everywhere.

- **Migration 0233** (`0233_checkout_drafts.sql`; 0232 is taken by PR #1363, which must merge
  first or the journal `when` order breaks): `order.draft_source` (`checkout` | `staff`, null
  reads as staff), `order.draft_expired_at`, `order.last_activity_at` (a checkout draft's last activity: the
  repeat-checkout match, 7-day expiry and Drafts list count from it), check constraint, backfill of existing drafts as
  `staff`, the worker's store list `stores_with_open_checkout_drafts()` (security definer), partial index `order_store_checkout_drafts (store_id, last_activity_at) where status = 'draft'
  and draft_source = 'checkout'`. The existing unique `(store_id, cart_id)` index already keys a
  checkout draft by its cart, so no new unique index was needed. Additive and nullable: old
  builds keep working during a rolling deploy.
- **Switch** `store.payments.unpaidAsDrafts` (`on` | `off`, unset = platform default). Read only
  through `checkoutDraftsOn` (`packages/core/src/payments/checkout-drafts.ts`), which also honours
  the global kill switch `CHECKOUT_DRAFTS=off` (app and worker env). `CHECKOUT_DRAFTS_DEFAULT` is
  `false` until the last PR of the series flips it.
- `draftsForMethod` (any method but COD, gift card, store credit) and `draftHoldMinutes` (online:
  the unpaid window, 30 min default; transfer: the transfer window, 48 h when transfers are never
  cancelled). `CHECKOUT_DRAFT_EXPIRY_DAYS = 7`.
- Staff drafts are now saved with `draft_source = 'staff'`.
