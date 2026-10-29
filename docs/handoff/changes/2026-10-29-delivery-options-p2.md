# Delivery options P2 (resilience and margin)

Branch `feat/delivery-options-p2`. **No migration** (0191 stays free): everything lives in Redis,
the order's `shipping` JSONB and the existing `shipment.courier_charge_paise`. Design:
`docs/superpowers/specs/2026-10-29-delivery-options-design.md` → "Latency budget and caching",
"Fallback when couriers are down or slow", P2. Developer docs: "Delivery options engine" →
Resilience, Order page; merchant guide: Apps → Delivery options.

## What exists now

- **Stale-while-revalidate** (`quotes.ts`): cache entries are `{ at, answer }` under a new `v2`
  key, kept 7 days. Under 6 h: used as is. Older: asked live within 800 ms; on a miss or failure
  the stale answer is used (`stale: true`) and the live call rewrites the entry when it lands.
  Place order's cache-only path takes stale entries too.
- **Circuit breaker** (`health.ts`): 3 failures (errors or missed deadlines) in 60 s per store
  and app → the app is skipped for 5 min; its stale answer stands in, else it is `failed`.
- **Health line** on Apps → Delivery options → Routes: per app, share answered, typical (median)
  latency, last error, **Skipped** chip while the breaker is open; plus "N of M checkouts in the
  last 24 hours fell back to your zone rates". Read by `deliveryOptions.overview` (`health`)
  through the new `ApiContext.deliveryHealth`.
- **Placed on backup** chip and **shipping margin** on the order page's new **Delivery option**
  card (`delivery-route-card.tsx`): charged vs courier cost (booking charge, else checkout quote)
  plus insurance. Margin only for staff with `analytics.read`.
- `@commerce/queue` `deliveryQuoteCache(redis)` (get/set + `incr`, capped `push`, `list`);
  `@commerce/core/delivery-margin` (pure `shippingMargin`).

## Not done / differs from the spec

- The breaker is **per app**, not per route: one app call answers for all its routes, so the app
  is what fails. The health line is per app too (the spec's "health line per app").
- Stale answers are used only when the live call misses or the breaker is open (the spec's
  wording), not served first: a stale hit still waits up to 800 ms for a live price.
- The order records `quoteSource: 'cache'` for a stale answer (no separate `stale` value on the
  order); the "on backup" marker reads `quoteSource: 'backup'`.
- Insurance in the margin is the amount priced at checkout (route rate); if an aggregator's
  booking charge already includes insurance, the margin under-counts by that much.
- Cache keys moved to `v2`: the first checkouts after deploy ask couriers live again.
- Try a PIN never uses the cache or the breaker and records no health.
- Not run here (owner rule): full vitest, tsc and builds. Run on dev.
