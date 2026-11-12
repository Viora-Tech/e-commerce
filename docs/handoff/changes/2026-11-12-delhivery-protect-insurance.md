# 12 Nov 2026: shipping insurance priced (Delhivery Protect, RapidShyp) in the drawer, checkout, booking and margin

Branch `feat/delhivery-protect-insurance`, migration **0242** (`0242_shipment_insurance_cost`:
`shipment.insurance_paise`). Owner's bug: in Create shipment › Select courier partner the
Shipping insurance switch only changed the label; no courier rate API returns an insurance price.

## What exists now

- **Delhivery Protect card** (core `shipping/delivery-options/protect.ts`,
  `protect-categories.ts`; browser-safe subpath `@commerce/core/delhivery-protect`): the owner's
  25 categories in basis points (Apparel 0.25% … Undetermined and Multi-category 0.60%). A
  product's category: the merchant's product-type override, else its Shopify taxonomy
  `categoryId` (longest prefix; `el-7-8`/`el-7-9` computer accessories and components →
  Computers, Laptops and Accessories), else words in its product type (Mouse, Mice, Glasspad,
  Mousepad, Skates, Keyboard, Keycaps → Computers), else Undetermined. Two or more categories in a
  parcel → Multi-category. Fee = declared value × rate, rounded to the paisa like Delhivery.
  Saved in `store.apps.settings['delivery-options'].protect` (no table); defaults need no setup.
- **Insurance price** (`insuranceQuote` in `routes.ts`): the courier's own quote line; for
  Delhivery direct always Protect (+ 18% GST, `INSURANCE_GST_BPS`); otherwise the merchant's
  route rate (% + minimum, + 18% GST), else the courier's published rate (`COURIER_INSURANCE`:
  RapidShyp 0.89% + 18% GST, an **estimate**; Shiprocket 1.05% GST included, exact; both for
  every carrier they book). Owner's real quotes are the tests: Delhivery ₹24,250 → ₹97.00 +
  ₹17.46, ₹4,699 → ₹18.80 + ₹3.38; RapidShyp ₹4,699 → ₹49.35, ₹26,899 → ₹282.49; Shiprocket
  ₹9,999 → ₹104.99, ₹14,889 → ₹156.33, ₹19,297 → ₹202.62.
- **Cover terms per courier** (`DEFAULT_COURIER_COVER`, `courierCover`, editable in the card's
  `couriers`): Delhivery Protect cap ₹30,000, fragile covered; Shiprocket cap ₹4,75,000,
  uninsured refund ₹2,500, fragile covered, used/open-box not covered, 0.5% claim excess;
  RapidShyp uninsured ₹2,500 (ToS 8.1), insured cap unknown. Rows carry `cover` (`rowCover`).
  The drawer's cover line says "Covers ₹30,000 of ₹40,000" when capped, the excess as a tooltip,
  warns "Without insurance, Shiprocket pays at most ₹2,500 if this ₹13,499 parcel is lost." with
  insurance off, and "Open-box / used items aren't covered by Shiprocket insurance." with it on
  (`isUsedProduct`: tag `open-box`/`used`/`refurbished` or a "[OPEN BOX]" title prefix).
  Delivery options › Routes › **Insurance cover** edits these.
- **Checkout** uses the same price (`priceRoute`/trace via `cartProtect`), so an insured
  Delhivery direct route is no longer ₹0. `CartItemFacts.categoryId` is now read.
  `loadDeliveryConfig(tx, storeId)` and `deliveryOverview(tx, storeId, providers)` take the store.
- **Create shipment drawer**: each rate row carries `insurance` (`rowInsurance`, server side,
  priced on exactly the value booking declares: `declaredValuePaise`/`quoteDeclaredValuePaise`,
  shared with `createShipmentForOrder`). With the switch on (`insured-rows.ts`) the fee + GST is
  added to the row total, the breakdown lists **Insurance** and **Insurance GST**, badges and Sort
  use the insured totals, the label reads "incl. GST + insurance". RapidShyp's line is
  **Insurance (est.)** with the hint "RapidShyp's own figure can differ slightly" (a part-shipped
  ₹19,297 order was billed on 110% of the value). A row with no rate says "Insurance rate not
  set" (link to Delivery options › Routes) and keeps "incl. GST". The cover line stays.
  `assignBadges` moved to `shipping/courier-badges.ts` (`@commerce/core/courier-badges`).
- **Booking** records `shipment.insurance_paise` (0 when not insured, null when insured with no
  known rate), worked out before the courier is called. **Margin** (`shippingMargin`) subtracts
  the booked figure, per parcel too (`parcelInsuranceCosts`), else checkout's.
- **Delivery options › Routes**: a Delhivery Protect card (rate per category, Delhivery's shown as
  the placeholder; product-type overrides) → `deliveryOptions.saveProtect`. The
  `insurance_unpriced` warning no longer counts Delhivery direct or RapidShyp. Route-setting help
  says GST is added on top.

## Not done / differs

- Owner's decisions (12 Nov): a merchant route rate gets 18% GST on top (it did not before);
  insured options cost more on Shiprocket and RapidShyp routes now (charged); the fee is on the
  full declared value even above Delhivery's ₹30,000 cover; on Delhivery direct the **Protect
  card always wins** (a route % is ignored for its insurance, and the route dialog says so).
- Fixed an old rounding leak for split carts priced from the Shipping rate: `addUp` took each
  parcel's rounded price less its insurance as the rate (₹49 + ₹35.40 → ₹90 counted the rate as
  ₹54.60, total ₹130); it now uses the rate itself (`PricedRoute.zoneRatePaise`): ₹120. A price
  capped by the option's min/max keeps its own figure.
- RapidShyp's own figure can differ (a part-shipped ₹19,297 order was billed on 110% of value).
- An aggregator quote that itemised insurance at booking is not seen at booking time (no quote
  lines then); booking records the route/default rate instead. Not seen in practice.
- No fragile item is blocked or warned about yet (no courier excludes glass so far); the
  `coversFragile` flag is there for it.
- Tested: core `src/shipping` vitest, admin create-shipment and delivery-options vitest; core, db,
  api, admin and storefront typecheck; `bun run lint`; `bun run test:sweeps` (4 failures, all in
  files from dev, none touched here: `resolve-store.ts` size, refund-sync files). DB tests and
  the 0242 migration were not run (no Postgres here).
- **Browser check owed** (no dev server on the owner's PC): the drawer with insurance on/off for
  a Delhivery, a RapidShyp and a Shiprocket row; the Protect card save; an order's margin card.
