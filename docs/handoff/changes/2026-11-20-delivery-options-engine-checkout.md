# Delivery options: rule engine and checkout fixes (20 Nov 2026)

Branch `fix/delivery-options-engine-checkout` (from `dev`). Issues #1781 (items 9–12 and the
19 Nov list) and #1782. The admin pages for the new settings are built on a separate branch
against the same names; this branch is the schema, the engine and the storefront.

## Settings contract (`packages/core/src/shipping/delivery-options/config.ts`)

- `RULE_TARGET_KINDS` gains `all` (every product, `target.values` is `[]`; other kinds still
  need at least one value).
- `RouteRuleInputSchema.forceRoute` (default false): when the rule's `defaultRoute` serves the
  PIN, it carries the parcel for every option the rule applies to, even of another speed. The
  shopper pays the option's normal price; the store covers the difference (shows in the
  order's shipping margin, which already compares charged against courier cost). No other
  couriers or alternatives are offered for that option. Booking (`bookingPlan`) tries the
  forced route first as the fallback and picks it when the order saved no route.
- `OptionPriceSchema.source` adds `free`: the option's own card is ₹0, list cards show
  "+₹ difference" on top, insurance the shopper ticks is still charged.
- `OptionCouriersSchema.max` is `2..20 | null`, default null (every courier that fits).
  Saved numbers are read as they are.

## Engine

- `rules.ts`: for each cart item only its most specific matching rules count (product >
  collection/tag/type > all, `RULE_SPECIFICITY`); same-kind winners still intersect, and when
  nothing is in common the most specific, highest-placed rule wins. Outranked rules are listed
  as overruled in Try a PIN. `matchRules` returns winners + outranked; `matchingRules` keeps its
  old signature (winners only), so booking follows the same specificity.
- `resolve.ts`: forced routes (`why.kind = 'rule_default'` with `forced: true`), the Free price
  (`price.ts`), the insurance tick and `not_faster`. `courier-list.ts` was split out of it.
- Insurance: the tick is offered whenever the order value allows (`onlyAbovePaise`); `default`
  only decides whether it starts ticked. Root cause of "no insurance choice at checkout": the
  engine offered it only when `default` was `on`. The tick shows only when a route that insures
  can carry the option and insurance costs more than ₹0; a route with no insurance rate (and no
  Delhivery Protect / aggregator rate) shows no tick. `insurance.extraPaise` is what ticking
  adds after the ₹10 rounding. `ResolveInput.insure` (true/false/omitted = default) replaces
  `declineInsurance`, which is still read for Try a PIN.
- Courier list: `max: null` shows every courier. The three-card floor (#1787) brings back a
  courier not on a card yet before another speed of one that is (Delhivery Express at the same
  date for +₹9 comes after Blue Dart or Amazon).
- Fixed options: an Express card whose pick does not arrive before Standard's hides, trace
  `hidden: 'not_faster'` (admin copy added, en + hi). A split cart compares the added-up
  cards (`resolveDeliveryOptions(..., { compareSpeeds: false })` per parcel, then
  `hideExpressNotFaster` in `resolveParcelDeliveries`).
- Titles (`labels.ts`): list cards and a pick of another speed than the option are named
  "Courier Speed" ("Delhivery Express", "Blue Dart Air"); a same-speed pick stays
  "Standard · Delhivery". A Standard card never carries an Express route under its own name.

## Storefront

- Courier logos 404ed: `src/proxy.ts` rewrote `/courier-logos/*` into the store's pages. The
  matcher now skips `courier-logos/` like `flags/`. Couriers without a file (Amazon Shipping,
  Ecom Express, Gati, Smartr) get an initials tile; add the file to
  `public/courier-logos/` and a line in `lib/delivery-cards.ts` `COURIER_LOGOS` to show a logo.
- `lib/delivery-cards.ts` (split from `lib/delivery-options.ts`): card labels from core
  `routeCardLabel`, per-card insurance, and `parcelDatesByCard`: each parcel's own dates per
  card from the engine run that priced the card. `delivery-method.tsx` shows those under the
  cards, and `place-order-create.ts` saves the engine's per-parcel promise on the parcels
  (fallback: the courier estimate as before). Fixes card Sun 22 Nov vs Parcel 1 Tue 24 Nov.
- Insurance tick follows the picked card; `checkoutShippingAction` takes `insure` (null until
  the shopper touches it); Pay sends the tick state the card was priced with.
- PIN hint: the form starts on Haryana, and the hint printed the form's state as is ("Jaipur,
  Haryana" for 302017). The hint now names a state only when it can be right for the PIN, and
  typing a PIN replaces a state that cannot be right for it even after the state was touched.

## Not done here

- Rule summary listing only the first allowed route (#1781, Mouse rule): built in admin
  components (`components/apps/delivery-options/format.ts` `ruleSummary` and `rule-row.tsx`),
  which the admin branch owns. It shows `defaultRoute` alone when one is set.
- The admin option form still clamps "Show at most" to 2..8 and offers only route/zone price
  sources (`option-form-state.ts`, `option-form.tsx`): admin branch.
- Tests (`rules.test.ts`, `resolve-checkout.test.ts`, fixtures in
  `src/testing/delivery-options-fixtures.ts`) were written but not run on this branch; run
  them on dev with the rest of the suite.
