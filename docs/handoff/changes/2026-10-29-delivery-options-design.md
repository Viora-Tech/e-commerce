# Delivery options at checkout: design

Branch `docs/delivery-options-design`. Docs only, no code.

- Spec: `docs/superpowers/specs/2026-10-29-delivery-options-design.md`. It covers an app,
  "Delivery options", that turns the connected courier apps (Delhivery, Shiprocket, RapidShyp,
  Blue Dart, ...) into checkout options with real ETA, price and COD, plus a Shopify-style
  rules list.
- It builds on what exists: `compareCourierRates` and `chooseCourier` (booking), zones and rates
  (they become the backup rates), and the serviceability cache.
- Phases P1–P4 are in the spec. Waiting on the owner's answers and their Waimers Shopify rules
  before P1.
