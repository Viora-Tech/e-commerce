# Only the recommended courier gets your price (28 Nov 2026)

Owner's choice: "Only the recommended courier gets your price; others pay their own price".

## Why

Live Waimers, PIN 131001, two mice under the Free "Mice" rule (preferred Delhivery Air). With
insurance ticked, the Standard list (`couriers.extra: 'difference'`) showed Amazon "+₹109" and
Ekart "+₹129": the Free price carried over to every courier and only the difference was added,
so two couriers of one aggregator (RapidShyp) added different insurance-looking amounts.

## The change

- New fourth `couriers.extra` mode, `own` (`config.ts` `COURIER_EXTRAS`).
  - The recommended pick keeps the option's or rule's price (Free stays ₹0, insurance included).
  - Every other courier card shows its own price (`ownPricePaise` in `courier-list.ts`): its
    shipping plus markup rounded the option's way, plus the cart's rule packing, plus its own
    insurance rounded the same way when the shopper ticked it and no rule requires it. Amazon
    and Ekart via RapidShyp therefore add the same insurance. Never below the pick's price.
  - The list is flagged `fullPrices`, so checkout, parcel lists and the admin checkout preview
    show each card's own price, not "+ ₹X".
- `priceFromPick`, `courierList` and `alternativesFor` take the `own` extras (packing,
  insurance) from `resolve.ts`. `difference`, `full` and `none` are unchanged.
- `shownPrices` / `orderDeliveryFor` need no change: they read the engine's cards, so the order
  charges exactly the card's price (tested insured and not).
- Admin: the "Show faster couriers at checkout?" question offers the fourth card
  (`delivery-questions.tsx`, `option-answers.ts`), the option example prices it
  (`option-example.ts`), copy in `delivery-option-questions.ts` / `delivery-option-sections.ts`
  with Hindi.

## Tests

- New `packages/core/src/shipping/delivery-options/own-price.test.ts` (6 tests): Free pick, own
  shipping, equal RapidShyp insurance, never cheaper than the pick, order charges the shown
  price, `difference` unchanged.
- Delivery-options core suite: 247 pass; only DB-backed `layout.test.ts` (2 tests) not run here
  (Docker was off). Admin delivery-options tests: 56 pass. Core and admin typecheck clean,
  `lint:components` at the 223 baseline.

## After release (owner, on the live store)

Waimers' Standard option still uses the old mode. After this is released, switch it in
**Admin › Delivery options › Options** (Standard, "Show faster couriers at checkout?") to
"Only the recommended courier gets your price; others pay their own price", then check PIN
131001 with two mice in Try a PIN.
