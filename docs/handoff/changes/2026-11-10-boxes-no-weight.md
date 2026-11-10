# A shipping box has no weight of its own (#1474)

Owner decision (10 Nov 2026): a box is a size only; the products carry the weight (packaging is
about 10 g, which never moves a courier's 500 g slab).

- `BoxPresetSchema.weightGrams` (`packages/core/src/shipping/settings.ts`) stays optional so old
  saved settings parse, but nothing reads it.
- The fallback when no product has a weight is now `ASSUMED_WEIGHT_GRAMS` (500 g) instead of the
  box's weight: `core/shipping/shipments.ts`, `core/returns/service.ts`,
  `api/services/create-shipment.service.ts`.
- Admin: the "Box weight (g)" field is gone from Settings › Shipping › Boxes; the box picker shows
  name and size only; the weight help text says where the weight comes from (en + hi).
- Real fix for courier prices is still correct product weights (next task).
