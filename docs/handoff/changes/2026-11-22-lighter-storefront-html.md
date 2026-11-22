# Lighter storefront HTML (22 Nov 2026)

Measured read-only on 22 Nov 2026: live pages fetched with `Invoke-WebRequest`, then broken down
by script (session scratchpad, `tools/br*.mjs`). Sizes are raw bytes of the HTML document.

## Before (live waimers.in)

| Page | HTML | gzip | RSC payload | Theme header | `<template>` | Inline CSS | Inline SVG | `srcset` | Whitespace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 696 KB | 102 KB | none (plain HTML) | 196 KB | 144 KB | 83 KB | 113 KB | 76 KB | 68 KB |
| `/collections/hmlab` | 437 KB | 72 KB | 36 KB | 196 KB | 137 KB | 52 KB | 60 KB | 46 KB | 44 KB |
| `/collections/atk` | 630 KB | 86 KB | 50 KB | 196 KB | 182 KB | 52 KB | 78 KB | 88 KB | 59 KB |
| `/products/wooting-80he` | 498 KB | 86 KB | 70 KB | 196 KB | 130 KB | 53 KB | 74 KB | 45 KB | 42 KB |

Inline script is not the problem: 47 to 109 KB per page, of which 36 to 70 KB is the RSC payload.
The HMLAB page has 69 KB of inline script in all, not 400 KB.

- **Theme header (Zero Drift `sections/header`), 196 KB on every page**, 40 to 45 % of the page.
  122 KB of it is the mega menu's 100 preview cards in `<template data-preview-template>`, which
  `header.js` builds on first open. Moving them out needs a theme change (a lazy fragment the
  theme's JS fetches). That is the owner's theme, not platform code; see
  `2026-11-15-lazy-header-first-visit.md` (123 KB raw / ~10 KB gzip less, tried there).
- Cart drawer section 60 to 110 KB (its recommendation cards), also theme markup.
- Indentation Liquid keeps from the templates: 42 to 68 KB per page.
- Product page RSC payload: the buy box's `product` prop carried the Lexical description
  (11.4 KB) on a store that hides the description block, and panel HTML for every spec field
  (2 KB) though only `package_contents` and `specification` panels show.
- Already deduplicated: theme markup is not repeated in the RSC payload (`lib/liquid-slots.ts`).

## Changed

1. **Theme HTML compacted** (`apps/storefront/src/lib/liquid-compact.ts`), applied in
   `liquid-theme.ts` to every section and layout part, and in `liquid-cards.ts` to the theme's
   product cards, before the render cache keeps them. Whitespace between a tag's attributes
   becomes one space; a whitespace run in text that holds a line break keeps only its line
   breaks. Attribute values, comments and the content of `script`, `style`, `pre`, `textarea`,
   `title`, `noscript` and SVG `<text>` are copied byte for byte. Checked with parse5 on the four
   live pages: same DOM, node for node (5,000 to 8,500 nodes), same attributes, same text apart
   from indentation. Draws the same under `white-space: normal`, `nowrap` and `pre-line`; only an
   element the theme set to `pre`/`pre-wrap` with indented child tags would lose that indentation.
   12 to 43 ms per page on a render miss, nothing on a cache hit.
2. **Product buy box gets only what it draws** (`apps/storefront/src/lib/product-view-props.ts`,
   used by `products/[handle]/page.tsx`): no description unless the description block shows, no
   extra fields unless the spec grid or panels show, and panel HTML only for a field a panel
   shows (`metafieldKey`). Field text stays for the spec grid and spec sheet.

## Expected savings

| Page | HTML before | After (measured offline on the live HTML) | gzip | brotli |
| --- | --- | --- | --- | --- |
| `/` | 696 KB | 627 KB (−68 KB, −10 %) | 102 → 99 KB | 69 → 67 KB |
| `/collections/hmlab` | 437 KB | 393 KB (−44 KB) | 72 → 70 KB | 51 → 49 KB |
| `/collections/atk` | 630 KB | 571 KB (−59 KB) | 86 → 84 KB | 59 → 57 KB |
| `/products/wooting-80he` | 498 KB | ~441 KB (−42 KB whitespace, ~−15 KB payload) | 86 → ~83 KB | 60 → ~58 KB |

Smaller DOM text to parse and less memory per cached section; on the wire it is 2 to 3 %. The
large remaining items are theme markup (header previews, cart drawer, inline SVG icons repeated
per card); a theme edit would cut far more than platform code can.

Old cache entries keep serving uncompacted HTML until their TTL ends.

Tests: `apps/storefront/src/lib/liquid-compact.test.ts`, `product-view-props.test.ts` (guards the
buy box's product prop).
