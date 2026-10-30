# Combo deals discount type (2026-10-31, #995)

A fifth discount type, `combo`: one discount holds Combo 1..N, each a set of products (any
variant) or exact variants with quantities, and its own discount (a combo price, a percentage
off the set, or an amount off the set). Works as a code or automatic.

- **DB**: migration `discount_combos` adds `discount.combos` (jsonb, `DiscountCombo[]`), null for
  other types. `DiscountType` gains `'combo'` (the `type` column is text, no enum change).
- **Engine**: `packages/core/src/discounts/combo.ts` (`comboAmount`, `comboSaving`). Each combo
  applies once per full set; no cart unit is used twice. Overlapping combos use a greedy pass:
  each round the combo saving most for one more set wins (ties to the earlier combo). Product
  combos use the dearest units first. `evaluateDiscount` handles `type === 'combo'` (dates,
  limits and eligibility checked first as for every type); `discountClass` counts it as a
  product discount for Combinations. The amount is an order-level reduction, so GST and the
  invoice spread it over the lines by value exactly as before (`splitByRate`).
- **Cart lines** now carry `variantId` (`loadDiscountCart`, `withCollections`, draft orders) so
  variant combos match.
- **Schema**: `DiscountInputSchema.combos` (max 20 combos × 20 items, each item once, value > 0,
  percent 0.01–100); a combo deal keeps `method: 'fixed'`, `value: 0`.
- **API**: list items now include `type` and `combos`; `products.searchVariants` takes `ids`
  (loads a saved combo's variants); the discount type filter offers Combo deal.
- **Admin**: "Combo deal" in the type chooser; `combos-card.tsx` + `combo-editor.tsx` (Browse
  with Products / Specific variants tabs, quantity per row, discount per combo, Add combo /
  remove); summary card lines per combo; Value column "3 combos". Copy in `data/discounts.ts`
  with Hindi in `data/hi/discounts.ts`.
- **Storefront**: no change needed; the saving shows under the discount title like other
  discounts. Not built: a "Buy as combo" hint on the product page.
- Tests: `packages/core/src/discounts/combo.test.ts`. Merchant guide: Discounts → Combo deal.
