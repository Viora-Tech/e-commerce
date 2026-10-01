# Zero Drift theme port, phase 2: home page, header and footer groups, product page

Branch `feat/glide-theme-phase-2`. No migration. The theme formerly called Glide is now named
**Zero Drift**; merchant-facing text says Zero Drift, while code paths (`sections/glide/`,
`GLIDE_SECTIONS`, `GlideCookieBanner`) keep the old name until a separate rename PR.

Inventory and statuses: `docs/design/glide-theme-port.md` (24 theme files now `ported (phase 2)`).

## What changed

- **Shared UI-kit effects** in `packages/blocks/src/effects/`, adapted from the originals rather than
  the theme's JS/CSS re-implementations: Magic UI Marquee, 3D Marquee demo and Safari (MIT); Aceternity UI
  Lens, 3D Card, Meteors, Animated Tooltip and Focus Cards (free tier; builder use permitted, see
  `docs/licences/aceternity-pro.md`). Keyframes in `styles/effects.css`. Credits in
  `THIRD_PARTY_NOTICES.md`, `packages/blocks/THIRD_PARTY_LICENSES.md` and `sections/sources.ts`.
- **Phase 1 swaps**: Latest drop uses the 3D Card, Brand lab uses Focus Cards, and Reviews showcase uses
  Safari, (3D) Marquee and Animated Tooltip. Category panels keep the theme's behaviour (no free original exists).
- **Home**: Hero (image and video slides), ProductGrid (tabbed products), FeaturedProduct refreshed in
  place; new Reviews and ImageComparison.
- **Header group**: AnnouncementBar (several messages, rotate or marquee, socials) and Header (mega menu
  with images, search overlay, brand pills, feature cards, sticky, wishlist link), both refreshed in
  place. The default header group now carries the theme's announcements.
- **Footer group**: Footer (help cards, socials, payment icons), Newsletter (interests, reasons, meteors)
  refreshed; new MobileDock, SignupPopup (3 styles) and CookieBanner (a dynamic section: look in the
  group, consent logic stays in `apps/storefront/src/components/privacy`). The default footer group
  follows the theme's order.
- **Product page**: MainProduct split into `components/product-*.tsx` with the Lens gallery and the
  buy-box blocks as section settings (promise blocks start off); new StickyAtc, ProductTabs, ProductSpecs,
  ProductSpecStrip, ProductFeatures, ProductSizeGuide, ProductSizeTable, ProductReviews (placeholder) in
  `sections/glide-product.tsx` (Products category). `SectionMetadata` gained `product` and
  `productActions`; the storefront product route and the admin preview set them.

## Behaviour changes on live product pages

- The delivery estimate is hidden on sold-out, pre-order and pre-launch variants (theme rule).
- The variant picker is hidden for single-variant products.
- The deposit line is formatted with `formatPaise` ("₹1,234").
- With the stock bar on, the "In stock / Only N left" line is replaced by the bar.

## Left for phase 2b / later

- A reviews data source (Customer reviews, Product reviews and the buy-box rating use typed values or a placeholder).
- Related products "complementary" intent (needs recommendations data).
- Product tabs: add-ons, recommendations and Judge.me tabs; metafield-driven buy-box spec cells.
- Category panels: owner's Pro "expandable cards" file or a decision (free Expandable Card is a modal list).
- Default product template in the theme's section order (owner decision).
- Wishlist page (the header icon links to `/pages/wishlist`).
- Confirm the Customize connect chip on fields nested in arrays (spec rows, strip values).

## Local note

`secret-fields` (sweeps) and `packages/core` `registries.test.ts` fail on this machine only because
bun cannot link `@aws-sdk/middleware-sdk-s3` (missing in the main checkout too); unrelated to this PR.
