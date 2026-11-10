# Checkout drafts, part 6: on for every store

- `CHECKOUT_DRAFTS_DEFAULT` (core `payments/checkout-drafts.ts`) and the admin's mirror
  `UNPAID_AS_DRAFTS_DEFAULT` (`components/settings/checkout-repeat-fields.tsx`) are now `true`:
  every store that never chose keeps unpaid online and UPI / bank transfer checkouts as drafts.
  A store turns it off in Settings → Payments → More → Repeated checkouts; `CHECKOUT_DRAFTS=off`
  in the app and worker env turns it off everywhere (drafts already saved still convert when
  paid).
- **Merge this last**, after parts 1 to 5 are deployed on every app and worker: an older worker
  would record a payment on a draft without converting it (design R2).
- **Existing unpaid orders stay orders.** Nothing is migrated or renumbered: open unpaid online
  orders finish under today's rules (the unpaid window cancels them, a late capture is flagged
  refund-needed), open transfer orders wait for "Mark as paid" as before. Only checkouts placed
  after the deploy become drafts.
- Tests that check the numbered-order path (`duplicate-checkout`, `routing-service`,
  `profiles-service`) pin `unpaidAsDrafts: 'off'` on their store.
- Merchant guide: "Unpaid checkouts" in `merchant-guide/orders/drafts.mdx`; "Payment pending" in
  `orders.mdx` points there.
