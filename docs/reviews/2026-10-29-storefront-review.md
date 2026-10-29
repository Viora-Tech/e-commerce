# Storefront review: Waimers on Koomerce, 29 Oct 2026

Live store https://waimers.koomerce.app (imported Zero Drift theme) against the original Shopify
store https://waimers.in, at desktop 1366 px and phone 390 px. Guest only: browsed, searched,
added to cart and went through checkout to the Payment step with the SES success address and
9999999999. Nothing was paid, no forms were submitted.

How it was checked:

- `scripts/smoke/storefront-audit.ts` (new, in this PR): 24 pages × 2 widths. Status, TTFB, LCP,
  console errors, failed requests, broken images, horizontal overflow, title / description /
  canonical / robots / JSON-LD, h1, image alt, unlabelled fields and buttons.
  `node --no-warnings scripts/smoke/storefront-audit.ts --base https://waimers.koomerce.app`
- `bun run smoke:checkout -- --base https://waimers.koomerce.app`: all 24 steps pass (home,
  collection, search, typo search, add to cart, cart, checkout, two PINs, Payment lists Razorpay).
- One-off Playwright probes for menus, filters, sort, empty states, cart, variants, and a
  card-by-card price and catalogue diff against Shopify (`/products.json`).

Screenshots referenced below are in `docs/reviews/2026-10-29-storefront/`.

## Blocks sales

| # | Page, width | What is wrong | Evidence | Likely code / owner | Status |
|---|---|---|---|---|---|
| 1 | `/products/atk-blazing-sky-x1-v2-series-esports-wireless-mouse`, both | The two *Extreme 2.0* variants were imported at 0.00. Shopify keeps them unavailable; here the product is a pre-order, so the variant shows **Rs. 0.00** with an enabled PRE-ORDER, goes into the cart and checkout shows **Pay ₹0**. Its card on `/collections/atk` and `/collections/all` shows Rs. 0.00. Only two ₹0 variants in the catalogue. | `zero-price-pdp.jpg`, `zero-price-checkout.jpg` | Owner: clear those prices (shows *Price coming soon* since #913) or archive the variants. Code decision: import 0.00 as no price; refuse ₹0 lines in `addToCart`/`placeOrder` | [#934](https://github.com/Viora-Tech/e-commerce/issues/934) |
| 2 | `/policies/*`, footer, both | Privacy, refund, shipping and terms pages all **404**; footer has no policy links. All five are live on Shopify. Payment gateways and Merchant Center check for them; the pre-orders are non-refundable, so shoppers look for the refund policy. | audit: 404 on all four | Owner: Settings → Policies, add and publish (lost in the 28 Oct reset). Code is in place (`app/-s/[storeId]/policies/[type]`, `shop.policies`) | [#935](https://github.com/Viora-Tech/e-commerce/issues/935) |

## Should fix

| # | Page, width | What is wrong | Evidence | Likely code / owner | Status |
|---|---|---|---|---|---|
| 3 | Pre-order product pages, both | Shopify's *This Product is on Pre-Order and will arrive around … NOTE: Pre-orders cannot be cancelled and are non-refundable.* is gone. Koomerce shows only *Available for pre-order*; *Expected to ship* needs a ship date that the import did not set. | `pdp-preorder-koomerce.jpg` vs `pdp-preorder-shopify.jpg` | `product-buy-buttons.tsx`, Shopify import pre-order mapping | [#936](https://github.com/Viora-Tech/e-commerce/issues/936) |
| 4 | Every product page, both | Announcement bar promises 3% off with UPI; Shopify shows *Rs. 6,789.00 with UPI · How?*, Koomerce shows nothing, so no UPI discount is configured (checkout total with UPI not verified: the review stops before Pay). | `_opts` probe text | `product-payment-signals.tsx` draws it once the store's UPI discount is set (owner) | [#937](https://github.com/Viora-Tech/e-commerce/issues/937) |
| 5 | Collections, both | Filters show variant options (Colour, Edition, Model, Size, Variant) instead of Shopify's Hand Size, Grip, Weight, Switches, Connection. | `collection-koomerce.jpg` vs `collection-shopify.jpg` | Metafield *Use as filter* (c0a997b4); import or owner setting | [#938](https://github.com/Viora-Tech/e-commerce/issues/938) |
| 6 | Every page, both | Console: *Executing inline event handler violates … Content Security Policy* (theme head's Noto Sans JP stylesheet `onload`). | audit `consoleErrors` | `apps/storefront/src/lib/liquid-defer.ts`, `liquid-shim.ts` | **Fixed here** ([#940](https://github.com/Viora-Tech/e-commerce/issues/940)) |
| 7 | Product pages and 404, both | An empty `<script type="application/ld+json">` (Shopify's `structured_data` filter renders nothing; our own JSON-LD is separate and valid). Search Console reports it as unparsable. | audit `jsonLd: ["invalid JSON", "Product", "BreadcrumbList"]` | `liquid-defer.ts` | **Fixed here** (#940) |
| 8 | Product pages, both | *Available for pre-order* and *In stock, ships today* are drawn in the error red. | `pdp-preorder-koomerce.jpg` | `section-product.css` `.buy-buttons__availability` | **Fixed here** ([#941](https://github.com/Viora-Tech/e-commerce/issues/941)): status colour, red only for *Only N left* |
| 9 | `/account/register`, both | 404. Shopify redirects it to the account sign-in; links to it survive in search results and old emails. | audit: 404 | new `app/-s/[storeId]/account/register/page.tsx` | **Fixed here** ([#942](https://github.com/Viora-Tech/e-commerce/issues/942)): redirects to `/account/login` |
| 10 | Pre-order product pages, both | No quantity picker beside PRE-ORDER (Shopify has one). Deliberate in `ProductBuyButtons` (`buyable` excludes pre-orders). | `pdp-preorder-*.jpg` | owner decision | [#939](https://github.com/Viora-Tech/e-commerce/issues/939) |

## Polish

| # | Page, width | What is wrong | Likely code / owner |
|---|---|---|---|
| 11 | `/cart`, both | `<title>` is just "Waimers". | **Fixed here** (#942): "Your cart \| Waimers" |
| 12 | 404 pages, both | `<title>` is just "Waimers", and the page has no h1. | `app/-s/[storeId]/not-found.tsx` |
| 13 | `/pages/faq`, both | No h1 on the page. | theme page template / content |
| 14 | Home, desktop | Hero has 4 slides on Koomerce, 5 on Shopify; Shopify's first slide is the *Victory Season Sale* banner, which is missing here. | owner content (hero section) |
| 15 | Collection cards, both | Koomerce shows *Save Rs. 1,500.00* and 3 columns; Shopify shows a *-15%* chip, 4 columns, a Compare checkbox and a CHOOSE OPTIONS / PRE-ORDER button per card. Cards with several prices show the lowest (WLMOUSE Huan Rs. 14,499) where Shopify shows the first variant (Rs. 15,999). | `product-card.tsx`, collection section settings |
| 16 | Product page, both | Title is in title case (Shopify: uppercase); no *Be the first to review* stars under the title when a product has no reviews. | theme heading setting; rating summary in the product buy box (`packages/blocks/src/components/product-view.tsx`) |
| 17 | Footer, phone | The payment badge text is cut: "American E". | footer payment icons (theme `footer` section) |
| 18 | `/blogs/news/test` | A post titled "Test" is published and in the sitemap (also live on Shopify). | owner content |
| 19 | Catalogue | `black-lotus` exists only on Koomerce (the checkout smoke buys it); `jinsoku-edgeless-speed-mousepad-` on Shopify became `jinsoku-edgeless-speed-mousepad` (old URL not redirected). | owner content / URL redirects |
| 20 | `/products/<handle>.json` | 404 (Shopify answers). No theme script on these pages asked for it during the review. | storefront routes, only if an app needs it |

## Checked and fine

- **Checkout:** guest contact, PIN 131001 (Sonipat, Haryana) and 400001 (Mumbai) fill city and
  state, free Standard delivery offered, Payment lists Razorpay. No 5xx, no page errors.
- **Cart page:** line, image, price, quantity stepper, Remove, discount code field, summary,
  payment icons. No free-shipping progress bar on either store (shipping is free on all orders).
- **Search:** "mouse" finds products; "muose" and "balck" are corrected; "zzqxv" shows *No
  results* with a Browse collections button.
- **Collections:** sort by price high→low is in order; an impossible price filter shows
  *0 products* with Clear all; `?page=99` answers 200.
- **Phone:** no horizontal scroll on any page (the marquee overflows inside its clipped bar
  only). Menu opens from the hamburger (`summary aria-label="Menu"`) and closes on Escape.
  Bottom dock (Search, Shop, Wishlist, Account, Cart) matches Shopify.
- **Cookie banner:** shows on first visit with Accept all / Decline / Choose cookies; no other
  popup opened within 8 s.
- **Images:** no broken images, no `<img>` without `alt`, no unlabelled inputs, no unnamed
  buttons or links found on the audited pages.
- **SEO:** titles, descriptions and canonicals on home, collections, products, pages and blogs;
  `noindex` on search, cart, account, filtered and sorted collections; JSON-LD Organization +
  WebSite (home), CollectionPage + BreadcrumbList, Product + BreadcrumbList, Blog, BlogPosting;
  `robots.txt` disallows cart, checkout, account, search and sort URLs and points to
  `sitemap.xml` (326 URLs).

## Timings

Warm cache, server answer (time to headers, three tries): home 125–134 ms, collection 116–152 ms,
product 98–104 ms, search 94–391 ms, cart 88–96 ms. The first request after a while is slower
(0.3–0.7 s, `/collections/audio` 1.6 s once): a render-cache miss. In-browser LCP on a warm
cache: 0.2–0.6 s on the phone context, 0.5–1.7 s on desktop (the hero video and late images).
Shopify for comparison: 10–300 ms TTFB, LCP 0.4–1.1 s.

## Fixed in this PR

- `liquid-defer.ts`: a theme `<link media="print" onload="this.media='all'">` loses its inline
  handler and gets `data-theme-promote`; the shim switches it on after hydration (it still also
  accepts the old `onload` form from a layout cached before the deploy). Empty `ld+json` scripts
  are dropped.
- `section-product.css` / `product-buy-buttons.tsx`: availability line in the muted status
  colour; `--low` (red) only for *Only N left*. Sizes moved from px to rem.
- `/account/register` redirects to `/account/login`; the cart page has a title.
- Tests: `liquid-defer.test.ts` (3 new), `packages/blocks/test/product-buy-buttons.test.tsx`,
  `apps/storefront/src/lib/account-register.test.ts`.
