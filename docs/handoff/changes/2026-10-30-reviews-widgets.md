# Reviews widgets as theme sections (2026-10-30)

Step 1 of the Judge.me widget parity plan: the Reviews app's widgets are theme sections the
merchant adds from Customize › Add section › **Apps › Reviews** (listed only while the app is
installed; saved placements keep rendering after an uninstall and draw nothing).

Sections (`packages/blocks/src/sections/reviews-widgets/`, types namespaced `reviews/*`):

- `reviews/Carousel` "Reviews carousel": limit, lowest stars, products, average, product,
  photos, date, card style, autoplay (pauses on hover/focus, pause button, off for reduced motion), seconds per review.
- `reviews/Testimonials` "Review testimonials": limit, lowest stars, products, columns, product.
- `reviews/AllReviews` "All reviews": products, per page, breakdown, star/photo filter chips,
  product, photos, date, card style. Loads up to 200 reviews and pages them in the browser.
- `reviews/Photos` "Review photos": limit, lowest stars, products, columns, product; photo opens
  in a dialog with its review.
- `reviews/Snippet` "Review snippet": product sections only; rating, count and a quote of the best
  4★+ review from `appBlockContext.reviews` (the product page already loads it).

The floating tab is an **app embed** (`reviews/FloatingTab`, `packages/plugin-reviews/src/blocks.tsx`),
toggled in the theme editor's Apps panel; settings: tab text, panel heading, side, lowest stars,
product. The storefront loads its reviews through `apps/storefront/src/lib/app-embed-data.ts`
(new: per-embed-type loaders, passed to the embed as `data`).

Data: `storeWidgetReviews` (`packages/plugin-reviews/src/widgets.ts`): published only, featured
then newest, `displayName` applied (imports keep full names), photos only when the store shows
them, draft products read as store reviews. Blocks get it through the new `loadReviews` loader
(`BlocksConfigOptions`): storefront `template-render.tsx` (cached per store version), admin
`customize-config.tsx` via the new `reviews.widgets` API route (ONLINE_STORE_READ).

Editor: each section shows a hint when the app is not installed or nothing matches; the
storefront draws nothing. Admin Add panel descriptions in `data/customize-add-section.ts`.

Tests: `packages/blocks/test/reviews-widgets.test.tsx`, `packages/plugin-reviews/test/widgets.test.ts`.
Merchant guide: `apps/docs/content/merchant-guide/apps/reviews.mdx` ("Show reviews around your store").

Left for later: section preview pictures (`bun run section-previews`), Hindi for the Add panel
descriptions (none of the descriptions have Hindi yet), the snippet inside the buy box itself
(it is a section placed under the product section), server-side paging for stores with more than
200 reviews on the all-reviews page.
