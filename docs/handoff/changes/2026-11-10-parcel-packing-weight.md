# Parcel weight = products + box packing; bulk "Set weight and box" (#1476)

Owner rule (10 Nov 2026): a product carries its own weight; a box adds its packing (carton,
bubble wrap, invoice). Replaces #1475 (which dropped box weight altogether).

- `resolveParcelWeightGrams(lines, packingGrams)` (`core/shipping/parcel.ts`): products' sum
  (`ASSUMED_WEIGHT_GRAMS` 500 g when any line has none) **plus** the packing. A box is never the
  whole parcel any more.
- Which box's packing: booking (`core/shipping/shipments.ts`) uses the box picked in the flow, else
  one matching the picked size, else `parcelBoxPreset` (the products' own box, else the main box),
  the same box it already recorded for packing cost. Create shipment quotes
  (`api/services/create-shipment.service.ts`) use `parcelBoxPreset`; returns use the main box.
- Settings › Shipping › Boxes: the field is "Packing weight (g)" with a help line (en + hi);
  a new box starts at 10 g.
- New `products.bulk` kind `shipping` (`core/catalog/bulk-shipping.ts`): `weightGrams`,
  `boxPresetId` (null clears), `optionValue` (only variants with that option, e.g. "XL").
  The box must exist in Settings › Shipping. Admin: Products › select › More actions ›
  "Set weight and box" (`components/products/bulk-shipping-dialog.tsx`). Also reachable over MCP.
- **After deploy (Waimers):** box weights are still product+packing totals (set so the old code
  quoted right). Set each box to packing only (mice 70, keyboards 10, cable/skates 10, glass 500,
  cloth 50, Hyzen 10, Veil 10, Remnant crate 500) **at the same time** as the product weights.
- Tests: `core/shipping/parcel.test.ts`, `shipments.test.ts`,
  `api/test/products-bulk-shipping.test.ts` (all variants, one option, unknown box refused,
  other store untouched).
