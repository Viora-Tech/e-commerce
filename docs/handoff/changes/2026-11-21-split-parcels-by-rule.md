# Split a cart into parcels when product rules share no courier (21 Nov 2026)

Owner decision, 21 Nov 2026: "split only when rules have nothing in common". When every product's
rules allow at least one common courier, the cart stays ONE parcel exactly as before. When they
have nothing in common (glass pads Delhivery only, mice Blue Dart only), the cart ships as one
parcel per rule group, each with its own courier, its own rule price, COD and insurance, and its
own label.

## Engine (packages/core/src/shipping/delivery-options)

- `rule-split.ts` (pure): `ruleGroups(config, items, answers, weightGrams)` returns the product
  groups, or null to keep the parcel whole. Decided for the option a rule price applies to (the
  courier list's option, else the first enabled Standard), over the same pool `rulePool` uses.
  Items under the same winning rules group together; groups merge (largest first) into a group
  they share a courier with; items no rule matches join the largest group.
- `rule-split-parcels.ts`: `ruleSplitter(tx, { cartId, config, boxPresets })` is the
  `splitByRule` step: each group gets its lines, value share, box and billed weight. Keys are
  the parcel's `locationId:status` key plus `:1`, `:2` (`isRuleSplitKey`).
- `checkout.ts` `quoteParcelDeliveries` takes `known` (answers already gathered) and
  `splitByRule`: after the first round, split parcels are asked again (in parallel) at their
  own weight. So a rule split costs one extra courier round, only when a split happens. A rule
  split applies inside each warehouse parcel (parcel = location x rule group).
- `parcels.ts`: when no courier is offered by every parcel but some parcel has choices of its own,
  the summed option carries `parcelOptions` (each parcel's own card). Not on backup, not for an
  option priced from the Shipping rate. `resolveParcelDeliveries` is still the one place prices
  are summed (`sumParcelRoutes` exported for per-parcel picks).
- `parcel-choice.ts`: `choiceKey`/`codFeeOf` moved here; `parcelShownPrices` adds each parcel's
  card prices to the snapshot as `<choiceKey>|p<i>` (and `|fee`); `parcelChoice` charges each
  parcel at min(now, its shown card) and adds them up.
- `DeliveryChoice.parcelRouteKeys` (optional, one per parcel, null = its own pick). A choice
  without it behaves exactly as before. `orderDeliveryFor` saves each parcel's picked route.

## Order and booking

- `OrderDeliveryParcelRoute.variantIds` (jsonb type only, no migration): `priceOrderDelivery`
  stamps each parcel's variants.
- `order/parcel-rule-split.ts`: `splitByDeliveryRoutes` cuts a routed parcel into one per saved
  route at its location (placeOrder's `reserveStock` step and draft conversion `routeAndBillDraft`),
  so two fulfilment orders exist at one location; stock holds are per location so nothing
  changes there. `parcelRouteFor` gives each its promised dates. `withParcelIds` now also
  matches by variants, so `deliveryForParcel` books each parcel on its own courier.

## Storefront

- `lib/delivery-options.ts`: both checkout paths (location split and whole cart) run the rule
  splitter; the whole-cart path only switches to parcels when `ruleGroups` says so. The Pay
  fallback without a snapshot (cache only) does the same. `CheckoutDelivery.parcels` lists
  each parcel's key and variants.
- `lib/parcels.ts` `pricedParcels` cuts the location parcels the way checkout priced them.
- `delivery-cards.ts`: `DeliveryCardExtras.parcels` (per-parcel courier cards).
- `components/checkout/parcel-courier-lists.tsx`: "Ships in 2 parcels", each parcel's products
  and its own `CourierList` (own radio group, `group` prop). The plain parcel list is not drawn
  again. `use-checkout-shipping.ts` keeps one route key per parcel, sums the picked cards for the
  summary and sends `parcelRouteKeys` with Pay. Copy: `data/delivery-options.ts` `splitNote`.

## Admin

- `rule-order.ts` `blockingRules` adds `separateParcels` warnings for pairs of enabled rules
  (sharing an option) with no courier in common: "a cart with both ships as separate parcels".
  The section title is now "Rules to check" (Hindi overlay updated).
- Try a PIN prices one parcel only (no multi-parcel support): not changed; see open items.

## Tests

- core `rule-split.test.ts` (grouping, free pad + paid mouse prices, per-parcel round trip
  through `shownPrices`/`orderDeliveryFor`, inside a warehouse split, no extra ask when common)
  and `order/parcel-rule-split.test.ts`.
- storefront `delivery-method-split.test.ts`; admin `rule-order.test.ts`.

## Open items

- Try a PIN does not show parcels (it never supported multi-parcel carts).
- Fixed layout: the split is decided for the first Standard option; Express is then priced per
  parcel and shows only when every parcel can carry it.
- A fixed-amount shipping discount is applied per parcel card on screen; the order applies it
  once to the total (free and percent discounts agree).
