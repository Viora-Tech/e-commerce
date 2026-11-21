# Product rule price: per-courier fixed prices and a packing charge (21 Nov 2026)

Owner, 21 Nov 2026: arm sleeves "Delhivery ₹99, Blue Dart ₹139"; switches pay the courier cost
plus a packing charge.

## Engine (`packages/core/src/shipping/delivery-options/`)

- `config.ts` `RulePriceSchema`: two optional fields. Rules saved before them parse unchanged.
  - `courierPaise?: Record<carrier, paise>` (Fixed only). Keyed by **carrier** (`delhivery`,
    `bluedart`: the carrier half of the dialog's `carrier:speed` chips), so one price covers
    both speeds of a courier.
  - `packingPaise?: paise | null`: added on top of the delivery price.
- `rule-price.ts`
  - `chargeFor` takes the route's carrier: on a Fixed rule a named courier costs its own price
    plus the insurance the shopper ticked (the same as Fixed today).
  - `packingFor(ctx)`: the sum of every rule price's packing in the cart, skipping prices that
    are ₹0 (Free, or free above ₹X reached: "if I say a delivery is free then I am including
    everything"). It is added **after** the option's rounding (₹49 + ₹20 = ₹69, not re-rounded),
    on top of the highest delivery charge ("highest wins" is unchanged for the delivery part).
  - `cartRulePrices` now lists each matched rule's price **once**, so its packing is charged
    once however many of its products are in the cart. The highest-price result is unchanged.
  - `ruleCardPricer(before, after, option, ctx, need)`: prices the other couriers' cards when a
    Fixed rule names couriers (returns null otherwise, so every card stays `priceFromPick` as
    before). Per rule price: a named courier costs its own price plus the insurance ticked (no
    difference); anything else charges what it charges the first courier (a Fixed rule's ₹X)
    plus the difference `priceFromPick` added. The highest wins, then packing.
- `courier-list.ts` / `pick.ts` (`alternativesFor`) take the optional `cardPrice`; `resolve.ts`
  builds it from the pick's pre-rule price (`prepaid.fits`) and its rule price.
- COD is unchanged: the COD charge is added on top of the card price (or kept as its own fee).
- Margin (`margin.ts`) needs no change: it is charged minus courier cost minus insurance, and
  packing only raises the charged price, never `courierCostPaise`, so it counts as revenue. A
  test checks that the saved courier cost is the same with and without packing.
- Split carts: each parcel runs the engine on its own items, so a rule whose products are in two
  parcels charges packing once per parcel (two boxes).

## Admin (`apps/admin/src/components/apps/delivery-options/`)

- `rule-draft.ts`: `courierFixed` (carrier -> rupees typed) and `packing`; `ruleCarriers(d)`;
  errors `courierFixed` / `packing` (blank is fine). `ruleInputOf` saves `courierPaise` only for
  a Fixed rule, only for couriers still in the rule, blanks dropped. It saves `packingPaise`
  only when set and the price is not Free, so a rule without them saves as before.
- `rule-price-fields.tsx` (step 4): under Fixed, "Different price for some couriers" with a ₹
  field per courier in the rule (shown when the rule has 2+ couriers; the placeholder is the
  rule's price). A "Packing charge" field is hidden on Free.
- "Shoppers will see" (`rule-sample.ts`, `rule-preview-line.tsx`): named couriers show their own
  price and packing is added to every card, with a caption line saying so. The live sentence
  (`rule-preview.ts`) adds "(Blue Dart for ₹139, plus ₹20 for packing)". The rule row chip
  (`rule-row.tsx`) reads "Fixed ₹99, Blue Dart ₹139, + ₹20 packing".
- Copy: `data/delivery-rule-form.ts`, `data/delivery-options-pages.ts`, with Hindi in `data/hi/`.

## Tests

- `rule-price-extras.test.ts` (core): a named courier, a courier not named, the first courier
  named, insurance on a named courier, free above with names, the order charging the named
  card, packing on the option's price and Fixed and not on Free or free above, no re-rounding,
  mixed-cart packing sums and packing once per rule, COD + packing, and an unchanged courier cost.
- `rule-price-draft.test.ts` (admin): draft round-trip, old shape kept, blanks and removed
  couriers dropped, packing not on Free, errors, the example cards and the live line.
