# Delivery options at checkout: design

Branch `docs/delivery-options-design`. Docs only, no code.

- Spec: `docs/superpowers/specs/2026-10-29-delivery-options-design.md`. It covers an app,
  "Delivery options", that turns the connected courier apps (Delhivery, Shiprocket, RapidShyp,
  Blue Dart, ...) into checkout options with real ETA, price and COD.
- Revised with the owner's decisions (29 Oct): the **route** model (courier × direct or
  aggregator channel), per-option strategy (cheapest / fastest), product and collection route
  rules (Glasspads → Delhivery; Mice → Delhivery Express or Blue Dart Air), price = route cost +
  markup + insurance rounded up to ₹10, Express prepaid only, no same/next day, the exact route
  saved on the order and booked.
- It builds on what exists: `compareCourierRates` (route quotes), zones and rates (Standard
  backup when couriers are down), and the serviceability cache.
- P1 now includes product route rules. Open: confirm insurance on the Shiprocket/RapidShyp
  accounts; Waimers Shopify rules for P3.
