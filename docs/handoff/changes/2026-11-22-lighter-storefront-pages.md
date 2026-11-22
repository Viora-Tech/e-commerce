# Lighter storefront pages, round 2 (22 Nov 2026)

Follows `2026-11-22-lighter-storefront-html.md` (theme HTML compacted, buy box description and
panel HTML trimmed; not deployed when this was measured). Read-only `curl` of live waimers.in
pages, broken down offline. Raw HTML bytes.

## Measured (live, before both rounds)

| Page | HTML | brotli | RSC payload | Biggest parts |
| --- | --- | --- | --- | --- |
| `/` (plain HTML path) | 696 KB | 92 KB | none | theme header 197 KB, hero 205 KB, cart drawer 74 KB, inline CSS 83 KB |
| `/collections/all` | 682 KB | | 60 KB | collection main 240 KB, header 197 KB, cart drawer 60 KB |
| `/products/lofree-hyzen` | 630 KB | | 101 KB | header 197 KB, main 143 KB, buy box props 52 KB |

(`/collections/mouse` is a 404 on the live store.) Most of the weight is the theme's own markup
(mega menu previews, cards with repeated inline SVG icons and `<template>` copies), which only a
theme edit can cut. What platform code still sent twice or too verbosely:

- **JSON-LD twice on every React page**: a server component's `dangerouslySetInnerHTML` is
  written into the HTML and again into the RSC payload. Product page 14.8 KB each copy,
  collection 4.3 KB, React home ~0.8 KB.
- **Buy box image variants**: each product image carried its `variants` map, 10 CDN URLs that
  are all the image URL plus `-w<width>.<format>`. 18 images = 36 KB of the payload.
- **Home h1**: the theme draws one, visually hidden (`Waimers`), so the live home already has
  exactly one. A theme without one (hero slide 1 with no heading) had none on the plain path.

## Changed

1. `apps/storefront/src/components/seo/json-ld.tsx` (+ client `json-ld-script.tsx`): JSON-LD goes
   through the same slot hand-off as theme markup (`lib/liquid-slots.ts`): on a page load the
   payload holds a slot id only; a client navigation or action still gets the JSON inline. Used by
   home, product, collection, search, blog and article pages. Crawlers see the same script.
2. `packages/blocks/src/image-variants.ts`: `compactImageVariants` swaps `variants` for
   `variantWidths` only when every URL rebuilds byte for byte (else the image is left as is);
   `productForView` applies it, and `ProductView` (now a thin wrapper over `ProductViewBody`)
   rebuilds the map before anything reads it, so the gallery, zoom and `<Picture>` are unchanged.
   The editor canvas and the Hono island pass full maps, which go through untouched.
3. `apps/storefront/src/lib/plain-html/home-heading.ts`: on the plain HTML home, if the header,
   sections and footer draw no `<h1>`, a hidden `<h1>` with the store name (inline clip styles,
   rem) goes at the end of `<main>`, after the sections, so `:first-child` rules still match. A
   theme that draws one (Waimers) is left alone: never two.

## Expected savings (offline, on the live HTML)

| Page | This round | With round 1 |
| --- | --- | --- |
| `/products/lofree-hyzen` | about −47 KB (JSON-LD −15, images −30 plus escaping) | 630 → ~520 KB |
| `/collections/all` | about −4.5 KB | 682 → ~610 KB |
| `/` | 0 on the plain path (no payload); −0.8 KB on the React path | 696 → ~627 KB |

Compressed, about 4 to 6 KB less on a product page. The rest is theme markup.

## Not done

- The React home path (stores without the plain HTML switch) gets no h1 safety net: its sections
  render as React, so the page cannot see whether one exists. Our own hero block already draws
  the first slide's heading (or product title) as the h1.
- Theme markup (header mega-menu previews 122 KB, repeated SVG icons ~64 KB of duplicates on the
  home) needs a theme change.

## Tests

`apps/storefront/src/lib/product-view-props.test.ts` (image round trip, foreign and bare images
left alone), `apps/storefront/src/lib/plain-html/home-heading.test.ts`; blocks
`product-page-parity` and `zero-drift-main-product` still pass. Storefront typecheck clean.
