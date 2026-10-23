# Discounts pass: owner fixes and Shopify parity

Branch `ui/discounts-pass` (from `origin/dev`).

## Owner-reported fixes (Create discount page)

- Option tiles fill their grid cells: `components/fields/choice-tile.tsx` (shadcn `FieldLabel`
  is `w-fit`). Only the discount cards used FieldLabel tiles.
- One required marker: `components/fields/required-mark.tsx` (red `text-destructive` star,
  aria-hidden, sr-only "required" in EN/HI), used by KitField, RichTextField and the discount
  fields.
- Plain radio rows: `components/fields/radio-option.tsx` (label beside the radio, no checked
  tint). Summary "No code yet" in the normal caption style.
- Browse picker: `components/pickers/resource-pick-dialog.tsx` (media-picker look: tabs,
  search, thumbnails, select all shown, infinite scroll) and `pickers/picked-field.tsx` (the
  form field with removable rows). "Specific collections" offered end to end.

## Shopify parity

- Types (`discount.type`): `products`, `order`, `bxgy`, `shipping`. Rows without one derive it
  (`discountType`). Buy X get Y maths: `packages/core/src/discounts/bxgy.ts` (cheapest items
  discounted, per-order cap, amount requirement earns a round per multiple).
- Minimum quantity (`min_quantity`) beside minimum amount (counted on eligible items for a
  products discount; the amount minimum still reads the whole cart, as before).
- Free shipping: `shipping_states` (empty = all), `max_shipping_paise` (rates above charged in
  full, in `applyDiscount` and `quoteCartShipping`).
- Customer eligibility (`customer_eligibility`, `eligible_ids`): `discounts/eligibility.ts`
  looks the shopper up by email and evaluates the picked segments. Unknown shoppers (cart, no
  email) pass until checkout; the storefront cart passes a signed-in shopper's email.
- Combinations (`combines_with`): `discounts/combine.ts`. Code first, then automatics most
  valuable first, one per class (products/order/shipping), both sides must allow; order
  discounts recomputed on what product discounts left. Merged outcome has `parts`; placeOrder
  claims and records a use per part.
- `CodeRejection` gains `min_quantity`, `not_eligible` (storefront copy added).
- Admin: type tiles (locked after create), per-type cards, minimum, eligibility with Browse
  (segments/customers), usage, combinations, summary lines. `api.customers.list` takes `ids`.
- Merchant docs: `apps/docs/content/merchant-guide/discounts.mdx`.

## Migration

`0155_discount_shopify_parity` (journal idx 139, after dev's `0153_platform_accounts`, prevId =
0153's snapshot, newer `when`). Idempotent: `ADD COLUMN IF NOT EXISTS`, and the `type` backfill
only touches rows still on the default where it is wrong, so it is harmless on the owner's dev
DB, where the statements were applied by hand before the renumber.

## Not done / notes

- At most one discount per class stacks (Shopify allows several product discounts per cart).
- Sales channels/markets: not needed.
- Local test DB: `localhost:5432` is taken by wslrelay on the owner's machine; tests were run
  with `.env.test` pointed at the host IP (not committed).
