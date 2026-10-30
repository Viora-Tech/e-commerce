# Catalogs › fixed prices on cart, checkout and cards (2026-10-31)

Leftovers of `2026-10-30-catalogs.md`: a market catalog's fixed variant prices now read the same
on the native cart, checkout summary and product cards as on the product page.

## Display math (`@commerce/money`)

- `presentmentLineMinor` / `formatPresentmentLine`: a line with a fixed price is that unit price
  × quantity; any other line converts its rupee total as before (same sums as `toLiquidCart`).
- `presentmentCartMinor` / `formatPresentmentCart`: an amount built on the subtotal. With a fixed
  line in the cart, the subtotal is the lines added up, and the total / amount to pay move by as
  much as the subtotal did (discounts, shipping and fees still convert from rupees), floored at 0.
  Without a fixed line nothing changes.
- `lowestPresentment`: a card's "From" variant, the lowest one unit as the market shows it, and
  whether the variants' prices differ. `hasFixedPrice` is the shared test.
- Tests: `packages/money/test/presentment-cart.test.ts`.

## Where

- `useFormatCart()` (blocks, `money-format.ts`): `line(l)` and `cart(paise, lines, subtotal)`;
  the store's own money format without a market.
- Cart drawer (`cartDrawerAction` now sends `variantId` + `unitPricePaise`), cart page lines,
  cart page subtotal and total (`<Money cart={…}>`), checkout summary lines (`SummaryLine.price`),
  subtotal, total and "To pay".
- Cards: `CardProduct.variantPrices` (set by `listCardProducts` / `listCollectionProducts` when a
  product has several priced variants). `Price variants={…}` shows "From <lowest>" when the
  shown prices differ, in every market (rupees too); the MRP shows only while the lowest is the
  rupee-cheapest variant and not fixed.

## Checkout still charges rupees

Unchanged. The existing `checkoutContent.chargedInRupees` note now says "in Indian rupees" and
also shows in the Payment card (a phone folds the summary away). Its "about" amount is the rupees
converted at the market rate, not the catalog prices: that is what the bank will roughly take.

## Left

- The card's sale badge (−%) is still worked out in rupees, also beside a fixed price.
- Deposit pre-orders: "Due today" / "Due later" still convert from rupees without the shift.
- Thank-you page and order emails show rupees, as before.

## Test

On a non-INR market (e.g. `/ae`) whose active catalog fixes a variant price: add it (qty 2) and
another product; drawer, `/cart` and checkout lines show fixed × 2, subtotal = lines added up;
the Payment card and summary say "You'll be charged ₹… in Indian rupees (about AED …)". A
multi-variant card reads "From AED …" with the lowest fixed or converted price. India unchanged
except multi-variant cards with different prices now read "From ₹…".
