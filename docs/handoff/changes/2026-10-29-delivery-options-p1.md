# Delivery options at checkout, P1 (routes, options, product route rules)

Branch `feat/delivery-options-p1`, migration **0189** (`0189_delivery_options`). Design:
`docs/superpowers/specs/2026-10-29-delivery-options-design.md` (carried over from PR #956).
Developer docs: "Delivery options engine"; merchant guide: Apps → Delivery options.

## What exists now

- Built-in app `delivery-options` (manifest `packages/core/src/shipping/delivery-options/app.ts`,
  free). Installed + at least one enabled option = checkout uses it; otherwise zone rates as before.
- Engine `packages/core/src/shipping/delivery-options/` (pure `resolve.ts`), parallel courier
  quotes with an 800 ms deadline and a Redis cache (6 h, by app, origin>PIN, 500 g slab, value
  bucket), quote snapshot (30 min) that `placeOrder` prices from, never above what was shown.
- Tables `delivery_option`, `delivery_route_rule`, `delivery_route_setting`; `shipment.carrier`,
  `shipment.delivered_at`. Order route lives in `order.shipping.delivery` (JSONB, no column).
- Checkout: "Express · Blue Dart" cards, sub-choices from a rule's alternatives, insurance
  checkbox (unticking re-picks from the same answers), Express prepaid only, Standard's COD route
  price on the Payment step, Standard-only backup when couriers are down.
- Booking: Create shipment preselects the saved route ("Chosen at checkout") and shows the reason
  and fallback when it cannot be booked; bulk books each order's own route, failures come back as
  "Needs a decision". Orders on backup still follow product route rules.
- Admin: Apps → Delivery options (routes + route setting dialog, options, product route rules
  dialog, Try a PIN with the full trace), option page `/apps/delivery-options/options/[id]`.

## Not done / differs from the spec

- **Insurance at the courier**: `CreateShipmentInput.insured` is passed, but no adapter sends an
  insurance field (none confirmed in the Delhivery, Shiprocket or RapidShyp docs; the owner says
  insurance is on at account level). The admin says "Insured per your courier contract".
- **Insurance rates are empty by default** (owner, 29 Oct): insured options add ₹0 and the app
  page warns until each route's % (+ optional minimum) is filled in.
- Reordering is by up/down arrows, not drag.
- Config is read from Postgres per checkout call (three small queries), not cached in Redis.
- `pushOrder` does not yet pass the chosen courier to Shiprocket's pending order.
- The order page shows the option and courier via the shipping line ("Express · Blue Dart"), not
  the full "via Shiprocket · insured · promised" thread; Settings → Shipping has no "app is on"
  line yet. Booked-route-differs-from-order-route is visible only by comparing shipment and order.
- P2 items (stale-while-revalidate, circuit breaker, health line, backup marker on the order,
  margin) are not started.

## Waimers setup (owner)

1. Install **Delivery options** from Apps; **Add Standard and Express**.
2. Routes card → Add a route setting for Shiprocket and RapidShyp (and Delhivery direct) with the
   insurance % and minimum once known.
3. Rules: **Glasspads** (collection) → all options → Delhivery, any channel; **Mice** (collection)
   → Express → routes Delhivery direct Express (default) and Blue Dart Express/Air (alternative).
   Keep Glasspads above Mice.
4. Try a PIN for a few PINs (metro, NE, a COD-heavy one) before telling customers.
