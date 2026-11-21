---
name: koomerce-delivery-options
description: Work on the Koomerce Delivery options engine (courier choice and shipping price at checkout). Use when changing product route rules, the rule pool, courier pick strategies, rule prices (Free, Fixed, free above), insurance, COD fees, courier list cards, split-cart parcels, the quote snapshot, shownPrices or orderDeliveryFor, booking the saved route, or the Delivery options admin pages and Try a PIN.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Delivery options engine

Developer guide: `apps/docs/content/developer-docs/building/delivery-options.mdx`. Engine code:
`packages/core/src/shipping/delivery-options/` (run
`bun run code-map packages/core/src/shipping/delivery-options` for a one-line map of every file).
Recent behaviour changes are in `docs/handoff/changes/2026-11-20-delivery-options-*.md` and
`2026-11-20-simple-rules-rule-price.md`; read the newest ones first.

## The pipeline

`resolveDeliveryOptions(input)` in `resolve.ts` is pure (no database, no network, clock passed
in). Checkout, `placeOrder` and the admin's Try a PIN must all get the same answer from it.
For each enabled option, in position order:

1. **Routes**: `routesFromAnswers` (`routes.ts`) turns the courier apps' answers into routes
   (courier x channel x service, key `providerId:serviceId`).
2. **Candidates**: routes the option allows with its speed (a `list` option takes every speed).
3. **Rules**: `matchRules` (`rules.ts`): per cart item only its most specific rules count
   (`RULE_SPECIFICITY` in `config.ts`: product > collection/tag/type > all); outranked rules are
   reported, not applied.
4. **Pool**: `rulePool` intersects the winners' allowed routes; nothing in common means the most
   specific, highest-placed rule wins. `poolAllows` filters candidates.
5. **Pick**: `pickFor` (`pick.ts`): a rule's `defaultRoute` (with `forceRoute`, it carries the
   parcel for every option the rule applies to), else `cheapest` or `fastest`. Drop reasons are
   kept for the trace. COD picks again with `cod: true` (Standard only).
6. **Price**: `price.ts` (cost + markup + insurance, rounded up to the next ₹10, caps, free
   above), `rounding.ts`, then the rule price (`rule-price.ts`: `cartRulePrices`,
   `withRulePrice`) on the courier list's option or the first enabled Standard option only.
7. **Courier list**: `courier-list.ts` (`courierList`, three-card floor `MIN_LIST_CARDS`, other
   couriers priced by `priceFromPick` per `couriers.extra`: the pick plus the difference, the
   courier's own full price (`full`, flagged `fullPrices` so checkout shows the row's own price),
   or the same). Titles: `labels.ts`.
8. **Split carts**: `parcels.ts` (`resolveParcelDeliveries`) runs the engine per parcel and adds
   them up; `hideExpressNotFaster` runs after the sum.

Then `checkout.ts`:

- `quoteDelivery` gathers answers (`quotes.ts`, 800 ms per app, cache, breaker in `health.ts`) and
  resolves. The storefront writes the **quote snapshot** with `shownPrices(result)`: every price
  the shopper saw, keyed by option, route, insured and payment, plus `|fee` keys for a separate
  COD fee.
- At place order, `priceOrderDelivery` (`order.ts`) re-runs the engine on the snapshot's answers
  and `orderDeliveryFor` charges `min(now, shown)` for the chosen key and saves the
  `OrderDeliveryRoute`. Booking reads it back in `booking.ts`.

## The consistency rule

Anything that can change a price the shopper sees must appear in **both** `shownPrices` and
`orderDeliveryFor` under the same key, or the order charges a different figure than the card
(or falls back to `now`). Typical traps:

- a new card type or a new per-card field (list cards carry their own `codPricePaise` and
  `codFeePaise`);
- COD in `separate` fee mode: the fee goes to `shipping.codSurchargePaise` and replaces the
  store's COD fee in `paymentAdjustmentFor`;
- insurance ticks re-quoting with the same `quoteId` (new prices are added to `shown`);
- split carts (`parcelKeys`, `codFeePaise` summed in `parcels.ts`).

The storefront side of the same contract: `apps/storefront/src/lib/delivery-options.ts`,
`apps/storefront/src/lib/delivery-cards.ts`, `apps/storefront/src/lib/use-checkout-shipping.ts`
and `apps/storefront/src/components/checkout/delivery-method.tsx`.

## Admin

Pages and dialogs: `apps/admin/src/components/apps/delivery-options/` (rule dialog steps
`rule-*.tsx`, Try a PIN `try-pin-*.tsx`, option form `option-form*.tsx`). Copy:
`apps/admin/src/data/delivery-rule-form.ts` and `delivery-options-pages.ts`, Hindi in `data/hi/`.
The admin imports the pure schemas as `@commerce/core/delivery-options`. API:
`packages/api/src/routers/delivery-options.ts`. The app manifest is `app.ts`; keep its `access`
in step when the engine reads a new resource.

## Tests to run

Core tests need the test Postgres (`docker compose up -d --wait`); the core suite's global setup
migrates it. Fixtures: `packages/core/src/testing/delivery-options-fixtures.ts`.

```sh
cd packages/core && bunx vitest run src/shipping/delivery-options
cd apps/admin && bunx vitest run src/components/apps/delivery-options
cd apps/storefront && bunx vitest run src/components/checkout/delivery-method.test.ts src/lib/delivery-card-line.test.ts src/lib/checkout-preview.test.ts
```

The ones that prove the consistency rule: `rule-price.test.ts` and `resolve-checkout.test.ts`
(both go through `orderDeliveryFor`), and `parcels.test.ts` for split carts. Add a case there
whenever a price shape changes. Owner workflow: on a branch you may skip the run and say so in
the handoff note; the suite runs on `dev` (see `koomerce-testing`).

Plain zone rates (no app) follow the Medusa-style shipping options pattern: the client sends a
rate id and the server re-quotes (`koomerce-commerce-patterns`, pattern 7).

## Do not

- Call a courier from `placeOrder`; it only re-runs the engine on saved or cached answers.
- Put `Date.now()` in the engine; pass `now`.
- Change live stores' prices silently: new behaviour gets a setting with a default that keeps
  today's result (as `OptionCodSchema.fee` defaults to `included`).
