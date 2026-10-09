# A different discount amount for each product, and the /discounts hydration error (issue #292)

- Branch `feat/per-product-discounts`, migration **`0093_discount_product_values`**: nullable
  jsonb `discount.product_values` (`{ productId: value }`, basis points for percent, paise for
  fixed). Column only, so the table's existing RLS covers it. Snapshot `0093_snapshot.json`,
  journal entry idx 88 (`when` after PR #293's 0092). **If #293 (0092) merges after this PR**,
  give its journal entry a `when` above 0093's and chain the snapshots' `prevId`, otherwise
  drizzle's migrator skips 0092 on databases that already ran 0093.
- **Rules** (`packages/core/src/discounts/evaluate.ts`, `perProductValues`, `perUnitAmount`):
  only for `appliesTo: 'products'` with `percent` or `fixed`. Each matching line gets
  value per unit × quantity; fixed is capped at the unit price, percent is basis points of the
  unit price rounded half up (same rounding as before). Cart products missing from the map get
  nothing; if no line gets anything the code is `no_eligible_items`. Minimum subtotal, windows,
  usage limits and the eligible-subtotal / cart caps are unchanged. Null or empty map: the old
  single `value` (fixed comes off once per order), so existing codes behave exactly as before.
  `describeDiscountValue` reads "₹200 to ₹300 off each item".
- **Validation** (`schemas.ts`): `productValues` record keyed by uuid, at most 500; when present
  it needs `appliesTo: 'products'`, not free shipping, a value ≥ 1 for every `appliesToIds`
  entry and no extra keys, percent ≤ 10,000 bp. The single `value` check is skipped then. The
  service stores `value = 0` for per-product discounts.
- **Admin**: `components/discounts/value-card.tsx` shows the switch "Different amount for each
  product" under Specific products; on, each picked row in `product-picker.tsx` gets an amount
  input (₹ or % by the method, via the new `rowExtra` prop) and the single value field hides.
  Form state `perProduct` / `productValues` in `form-state.ts`; copy in `data/discounts.ts` (no
  Hindi overlay exists for discounts yet).
- Orders still store one `discountPaise` (no per-line discount columns exist); GST keeps
  spreading it over the lines by value, as for any product-scoped discount.
- The Shopify importer still leaves "amount off each item" discounts behind
  (`per_item_amount`); a product-scoped one could now map onto `product_values`. Not done here.
- **React #418 on /discounts**: the production images ran Alpine's `nodejs`, which ships
  English-only ICU data (`icu-data-en`). Node then formatted `en-IN` as `en-US`, so the Active
  dates column rendered "01-14-2026" on the server and "14-01-2026" in the browser (numbers
  also lost Indian grouping, Hindi fell back to English). Fix: `apk add nodejs icu-data-full` in
  the admin, storefront and docs Dockerfiles; the `date-format` sweep now fails if a Dockerfile
  installs `nodejs` without it. Takes effect on the next image build and deploy.
- Docs: `apps/docs/content/merchant-guide/selling/discounts.mdx` (new).
