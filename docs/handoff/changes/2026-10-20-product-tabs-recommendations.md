# Product tabs and "You may also like" on imported themes

Compared `waimers.in/products/x2h-gaming-mouse` (Shopify) with `waimers.koomerce.app`. All three
gaps are in the imported theme's Liquid sections (`product-tabs`, `related-products`). Our own
blocks are not involved.

## Accessories tab: "Complete your setup" was empty

Cause: an engine bug. `snippets/product-add-ons.liquid` resets its list with
`assign items = blank` and then tests `items == blank`. In Shopify the `blank` and `empty`
literals are the empty string when used as values. LiquidJS stored its literal object, which
never equals `blank`, so every fallback path (manual picks, mousepads, accessories collection)
was skipped and the row printed nothing. The tab itself still showed because its panel holds a
`<script>` tag.

Fix: our own `assign` tag (`theme-import/assign-tag.ts`) stores `''` for `blank` and `empty`.
Checked with the theme's real snippet on fake data: the row lists the pad, skates and grip tape.

## Ratings & reviews tab: missing

Cause: the tab holds only Judge.me's app block
(`shopify://apps/judge-me-reviews/blocks/review_widget/…`). App blocks are Shopify-hosted, so
they rendered nothing, and the theme's `_tab` block hides a tab whose contents have no text.

Fix: `theme-import/app-blocks.ts` draws Judge.me's review widget as a slot
(`<div data-commerce-app-block="reviews">` with a "Customer reviews" heading) when the Reviews
app is installed. Without the app it still prints nothing. The product page renders our
`ReviewsWidget` (now exported from `@commerce/blocks`) into that slot through
`components/theme/liquid-app-block.tsx`, a portal that finds the slot again if the theme's markup
is replaced. Other app blocks still print nothing.

## You may also like: empty

Cause: `/recommendations/products` (shim → `/theme-actions/recommendations`) answered 200 with an
empty section. `relatedProducts` ranks by shared collections, so other models of the same brand
and kind rank first. It loaded only the top `limit × 3` (12) and then dropped sold-out ones. On
Waimers those close matches are mostly sold out, so nothing was left.

Fix: `firstAvailable` in `related.ts` reads the ranked list a chunk at a time until it has
`limit` in-stock products (up to the 120-candidate pool).

## Not fixed here (data)

Some products that are pre-order on Shopify (for example the Kyomi Jane Glasspad) read
"Sold out" on Koomerce's Liquid product cards, while our product page shows them as pre-order.
Liquid `available` is stock or pre-order (`product-data.ts`), the same rule the product page
uses, so check the product's pre-order flags and the render cache for that store.

Tests: `theme-import/product-tabs-content.test.ts`.
