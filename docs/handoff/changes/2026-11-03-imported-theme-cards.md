# Imported themes: the theme's own product cards, and more theme settings on our main sections

Branch `fix/imported-theme-cards` (#1047, #1048). No migration.

## #1047: collection grid cards

- On a store whose live (or previewed) theme is an imported Shopify theme, `MainCollection`
  draws each card with the theme's own card snippet through the Liquid engine:
  `packages/core/src/theme-import/theme-cards.ts` finds, in the theme's main collection section,
  the `{% render %}` call inside `for … in collection.products` (Zero Drift's `product-card`,
  Dawn's `card-product`), with the section's own `assign x = section.settings.y` lines and its
  stylesheets; falls back to a bare `card-product` / `product-card` snippet.
  `renderThemeCards` (core `render.ts`) renders it once for the page's handles and splits it per
  card. Storefront: `apps/storefront/src/lib/liquid-cards.ts` (`themeCardsFor`, cached like a
  section), drawn by `components/collections/collection-grid.tsx` via `LiquidHtml`.
- Fallback: no snippet, a failed render, or a product the Liquid data has not got → our React
  `ProductCard` for that card (or the whole grid).
- The card's `{% form 'product' %}` posts to `/theme-actions/cart-add` like every theme form
  (swap.ts `cart_add`), and the theme's own cart JS goes through the shim.
- The grid carries `shopify-section` when it holds theme cards, so our Zero Drift card CSS
  (same class names, fenced with `:not(:where(.shopify-section *))`) stays off them.
- The import keeps the theme's main collection sections on our `MainCollection` as
  `_themeSections` (type, key, stored settings) so the card reads the merchant's values; stores
  imported before this read the section's schema defaults.

## #1048: settings carried over

- `MainCollection` gained `columns`, `columnsMobile` (0 = automatic, the old rhythm),
  `showBreadcrumbs`, `uppercaseTitle`; CSS in `styles/section-collection.css`
  (`data-columns`, `--columns-desktop`). The editor's columns setting did not exist before.
- Import (`main-collection-props.ts`): `columns_desktop`, `columns_mobile`, `show_description` /
  `show_collection_description`, `show_collection_image`, `enable_filtering`, `enable_sorting`,
  theme setting `show_breadcrumbs`.
- `MainProduct` gained `uppercaseTitle`, `addToCartStyle` (`outline` | `solid`, filled with a cart
  icon), `trustBadgesLayout` (`chips` | `grid`). No theme setting holds these: the import reads
  them from the theme's files (`theme-look.ts`): an `h1` rule with `text-transform: uppercase`,
  a `.trust-badges { display: grid }` rule, an Add to cart with the primary button class (or
  Dawn's buy buttons without the dynamic checkout button).
- Shopify's built-in `/collections/all` now sorts A to Z by default, as Shopify does
  (`apps/storefront/src/lib/collections.ts`).
- Skipped (no clear source): sort position (Zero Drift hardcodes it in markup), products per page
  (the page loads before the template's settings are read), the built-in collection's title
  ("Products" on Shopify), breadcrumb wording.
- Already-imported stores (Waimers) keep their saved settings: re-import the theme, or set the new
  fields in Customize, to pick up the mapped values.
