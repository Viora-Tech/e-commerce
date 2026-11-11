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

## Split carts: one parcel per location (owner's follow-up, 11 Nov)

- Split: `cartDeliveryParcels` (`delivery-options/cart-parcels.ts`) reuses `previewCartParcels`
  (`order/parcel-view.ts`), which runs `routeOrder` (`order/routing.ts`) the way `placeOrder`
  routes the order, without holding stock. One parcel (or none): `[]`, and checkout takes the old
  single-parcel path unchanged (origin = Settings › Shipping, same cache keys).
- Each parcel: its lines, its value share (by its goods' prices, `shareValue`), the PIN code the
  courier collects from (`pickupPincodeOf` in `ship-from.ts`: the location's own with courier
  pickup and a full address, else Settings › Shipping, as `shipFromFor` books), and its own
  `cartParcelFor` box and billed weight.
- `quoteParcelDeliveries` (`checkout.ts`) asks every parcel's couriers at once with the same
  `gatherProviderAnswers` deadlines (800 ms, 2.5 s cold), so the wait is the slowest parcel.
- `resolveParcelDeliveries` (`delivery-options/parcels.ts`) runs the engine per parcel and adds
  the cards up per option. Decisions: an option shows only when every parcel has it (a parcel
  whose couriers are down falls back like one parcel: Standard on backup at the Shipping rate,
  Express hidden); prices/cost/markup/insurance sum, but the Shipping rate (a backup parcel or an
  option priced "from the Shipping rate") counts once, the highest; free-above and insure-above
  read the whole order (`ResolveInput.orderValuePaise`, new, optional); dates are the last
  parcel's; any parcel on backup puts the option on backup (no route saved); sub-choices are the
  couriers every parcel offers, summed; the saved route is the first parcel's pick.
- Snapshot: `DeliveryQuoteSnapshot.parcels` (lines, value, answers per parcel). The insurance tick
  reuses it; `deliveryForOrder` passes it on, or rebuilds the split from cache only; place order
  (`priceOrderDelivery`, `OrderDeliveryInput.parcels`) re-prices each parcel and adds them up.

## Try a PIN: "Products I pick" (owner's follow-up, 11 Nov)

- Admin Try a PIN has a mode toggle: "A weight I type" (as before, plus "Products for rules") or
  "Products I pick" (shared Select products dialog, quantities; `try-pin-lines.tsx`). The order
  value follows the picked goods and stays editable.
- API `deliveryOptions.tryPin` takes optional `lines`; `tryDeliveryPin` builds the parcel with
  `cartParcelFor` (box + billed weight, sent to couriers with the box) and returns it as
  `parcel`; Shipping rates read the products' own weight, as at checkout. One parcel from Settings
  › Shipping (Try a PIN does not split by location). Copy in `data/delivery-options.ts` + Hindi.

## Not changed (on purpose)

- The store's own **Shipping rates** (zones, weight/price bands, free-above) still use the cart's
  product weight (`zone.measure`). They are merchant-defined; the owner's free India shipping stays
  free. The Delivery options backup (Standard at the Shipping rate) is unchanged too.
- Try a PIN's typed-weight mode still uses the weight the merchant types.
- The order still saves one route (the first parcel's); booking the other parcels follows the
  merchant's courier choice as before.

## Verify

Browser check owed (no dev server on the owner's PC): a cart with a glasspad in its 64 × 64 × 8 box
should show the ~6.5 kg courier price at checkout; a cable in a small box its actual-weight price.
A cart with stock only split across two locations should show the two parcels' prices added up.
Try a PIN: "Products I pick" with the glasspad shows "6.55 kg, packed in 64 × 64 × 8 cm".
