# Delivery options app: default card, preferred courier, hidden names, COD hint, RapidShyp (11 Nov 2026)

Follow-up to the Waimers batch (#1482), which shipped the first half of these fixes.

- **#1519 Default card.** `apps/storefront/src/lib/default-rate.ts` (`nextRateId`): after each
  courier answer checkout ticks the cheapest card (ties keep the store's order). Only a card the
  shopper picked (or a courier under it) survives a new answer; checkout's own default is
  re-picked, so a card that was cheapest once no longer stays ticked after prices change.
- **#1520 Preferred courier.** Option setting `preferCarrier` (Routes and strategy → Preferred
  courier). Among routes at the same shopper price as the first, the preferred courier wins,
  then the earliest arrival (the #1482 rule). Fastest keeps its date: only same-date, same-price
  equals are swapped. Never makes the shopper pay more. Stored in the option's JSONB, no
  migration.
- **#1521 Courier names.** Option setting `couriers.showNames` (Couriers at checkout → Show
  courier names to shoppers, on by default). Off, every route of that option has
  `showCarrier: false`: the card reads only the option name, no logo, Air/Surface on choices,
  no courier in the COD note. The per-courier switch from #1482 still works; option Routes
  (Only these / All except these) limit which couriers are used.
- **#1522 COD hint.** `lib/delivery-card-note.ts`: the quiet "Pay online for this option" note
  under a prepaid-only card shows only when cash on delivery is a way to pay at this checkout.
  Never red; Payment explains COD when the shopper picks it.
- **#1524 RapidShyp.** Cause found: checkout's three parallel asks (prepaid rates, COD rates,
  serviceability) made six `serviceabilty_check` calls, four with the same body, and
  serviceability made its two calls one after the other (two round trips, ~1.8–2 s). The adapter
  now shares identical calls in flight and runs serviceability's two calls at once: two calls,
  one round trip. Whether that fits 800 ms depends on RapidShyp's own response time (not
  measured: no live calls). Not changed: a missed deadline still counts toward the circuit
  breaker (3 in 60 s skips the app for 5 min), which also pauses the background refresh of
  its cache; see the PR for the open question.

Docs: merchant guide (Delivery options) and developer docs (engine Pick step) updated.

Browser check owed: checkout with Standard ₹0 + Express ₹50 ticks Standard; Express hint only
with COD on; an option with names off shows no courier name or logo; the option page's new
Preferred courier select and Show courier names switch save and reload.
