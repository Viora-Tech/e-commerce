# Checkout courier prices use the billed weight (#1546)

Branch `fix/checkout-billed-weight`, PR into `dev`. Built on `fix/variant-box-approval-notice`
(#1540): merge that first, then rebase this onto `dev`.

## Why

Checkout's Delivery options app asked couriers with the cart's bare product weight and no box.
Couriers bill the higher of actual and volumetric weight (L × W × H cm ÷ 5000 kg), so a glasspad
(about 1 kg in a 64 × 64 × 8 cm box, about 6.5 kg billed) was under-quoted. Owner (11 Nov 2026):
checkout uses the billed weight, the same parcel the admin would book.

## What changed

- `cartParcel(lines, boxPresets)` in `packages/core/src/shipping/parcel.ts`: the cart's parcel from
  the admin's own helpers (`resolveParcelPackage`, `parcelBoxPreset`, `resolveParcelWeightGrams`,
  `effectiveWeightGrams`). Box: the products' own (variant's own box, else the product's, both
  stored on the variant), biggest when they differ, else the store's main box (as the booking flow
  pre-fills). Weight: products plus that box's packing (unknown weight counts 500 g, as booking).
  Returns `{ actualGrams, billedGrams, dimensionsCm }`.
- `cartParcelFor(tx, lines, boxPresets)` in `delivery-options/service.ts` loads the variants
  (skipping lines that never ship) and calls it.
- Storefront `checkoutDelivery` and `deliveryForOrder` (`apps/storefront/src/lib/delivery-options.ts`)
  ask couriers with `billedGrams` and the box, and give the engine `billedGrams` as the cart weight
  (route cost cards are courier rate cards, so they price billed weight too).
- `priceOrderDelivery` (`delivery-options/order.ts`) re-runs the engine at place order on the same
  billed weight, so cost-card prices match what the shopper was shown.
- `delivery-options/quotes.ts`: `CheckoutQuoteQuery.dimensionsCm` (optional) goes to each courier's
  `RateQuery.dimensionsCm`; the cache key appends `:LxWxHcm` when there is a box. Without a box the
  key is unchanged (still `v2`), so nothing cached is thrown away. The 800 ms / 2.5 s cold
  deadlines are untouched.

## Not changed (on purpose)

- The store's own **Shipping rates** (zones, weight/price bands, free-above) still use the cart's
  product weight (`zone.measure`). They are merchant-defined; the owner's free India shipping stays
  free. The Delivery options backup (Standard at the Shipping rate) is unchanged too.
- Admin **Try a PIN** still uses the weight the merchant types.
- A cart that the admin later splits across locations is still quoted as one parcel at checkout.

## Verify

Browser check owed (no dev server on the owner's PC): a cart with a glasspad in its 64 × 64 × 8 box
should show the ~6.5 kg courier price at checkout; a cable in a small box its actual-weight price.
