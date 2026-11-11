# 11 Nov 2026: oversold products save again (#1509)

Pre-orders sell past stock, so on-hand goes below zero. The product form sends each variant's
on-hand back, and `VariantInputSchema.onHand` (and `products.updateVariant`) required >= 0, so
any oversold product could not be saved at all ("Variants: Too small: expected number to be >=0"),
pre-order switches included.

- `onHand` accepts values below zero; an unchanged value is a zero delta and writes nothing.
- `nextOnHand` refuses only a fall below zero: oversold stock may rise towards zero (receiving
  part of what is owed). Test in `inventory/stock.test.ts`.
