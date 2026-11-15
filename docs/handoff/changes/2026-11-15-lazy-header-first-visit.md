# Lazy header cards and first-visit plan (speed track, owner-approved 6 Nov)

Measured from this PC on 15 Nov 2026 with Playwright (Chromium, phone viewport, 4x CPU, 1.6 Mbps,
150 ms RTT, cache off, medians of 5 to 9 loads), read-only GETs to https://www.waimers.in.
Candidate changes were A/B tested against the live page before any code was written: the live
HTML is fetched once and served to the browser through `page.route`, unchanged for control and
rewritten for each variant (scripts in the session scratchpad, `perf/ab.mjs`, `perf/measure.mjs`).

## Baseline (live, 15 Nov)

| Page | Requests | CSS files / KB | JS files / KB | Images KB | FCP | LCP |
| --- | --- | --- | --- | --- | --- | --- |
| Home (plain HTML) | 91 | 37 / 305 | 23 / 105 | 543 | 1.32 s | 1.56 s |
| Wooting 60HE v2 (React page) | 84 | 23 / 313 | 41 / 528 | 89 | 4.37 s | 5.30 s |
| Pulsar ES XLite (React page) | 91 | 23 / 313 | 44 / 541 | 115 | 4.48 s | 4.78 s |

CSS on home: 33 theme files (`/theme-assets/…`, 5 in `<head>`, the rest in the body next to their
sections), 3 Google Fonts stylesheets (one is Noto Sans JP, 89 KB, already print-then-promoted).

## Shipped

1. **Product gallery: the slide the page opens on is the eager, high-priority image**
   (`packages/blocks/src/components/product-gallery.tsx`). It was always slide 0; a product whose
   default variant has its own photo opens on that photo, which was `loading="lazy"` while an
   unseen slide 0 took the high priority. Wooting 60HE v2 lab LCP **4.71 s → 4.15 s (−0.56 s,
   −12 %)**, A/B of the exact markup this change produces. Products that open on slide 0
   (Pulsar ES XLite) are unchanged (3.98 s vs 4.08 s, noise).
2. **Native header: menu card photos load on first open**
   (`header-nav.tsx`, `header-menu-panel.tsx`, `header-menu-card.tsx`). A closed dropdown is only
   `visibility: hidden` / `grid-template-rows: 0fr`, and Chrome fetched every card photo on every
   page view, `loading="lazy"` or not. Now a card's photo is drawn from the first hover (during
   the open delay, so it is on its way before the panel shows), focus or tap; the card links and
   the menu links stay in the server HTML (SEO, no JS), and until then the empty media box shows
   the card's own tone. Measured with the real header stylesheet and the component's server
   HTML (two photo cards): **2 photos fetched → 0** on a plain page view.
   Imported Liquid themes: Waimers' Zero Drift header already keeps its 100 preview cards in
   `<template data-preview-template>` and builds them on first open (`header.js`), so the live
   page fetches **0** menu images today (only the 4 logo files); nothing to change there.

## Tried and dropped (no gain in the lab)

| Step | Result | Why dropped |
| --- | --- | --- |
| Head theme CSS (5 files) as one file | FCP 0.95 → 0.47 s but LCP 1.18 → 1.30 s | LCP worse; HTTP/2 already fetches them in parallel from the edge (`immutable`, cf HIT) |
| Two Google Fonts stylesheets as one | LCP 1.07 → 1.06 s (9 runs) | noise |
| Preconnect `cdn.koomerce.app` + `fonts.gstatic.com` | home 1.07 → 1.08 s, product 4.71 → 4.70 s | the header logo already opens the image connection early |
| Preload the image the gallery opens on | 4.15 → 4.31 s | worse than the eager `<img>` alone |
| Header previews out of the HTML (lazy fragment) | 123 KB raw / ~10 KB gzip less HTML, LCP 1.18 → 1.06 s in a noisy 5-run set | needs the theme's `header.js` to fetch them; theme change, not platform code (see owner list) |
| Delay platform JS | already done: theme scripts are parked until hydration / near view (`liquid-defer.ts`), plain pages load chat, pixels and banners on idle or interaction (`plain-html/modules.ts`), GA4/GTM/Meta are `lazyOnload`, Chatwoot `lazyOnload` | nothing left to delay without a refactor (below) |

## For the owner

- **Cloudflare: HTML is not cached.** `curl -I https://www.waimers.in/` returns
  `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=3000` but
  `cf-cache-status: DYNAMIC`, so every page view goes to the origin. On the SaaS zone (the one
  that serves the custom hostnames): Caching → Cache Rules → "Store pages", with the expression in
  developer docs "Storefront performance" → "Cloudflare in front", step 4; Then: **Eligible for
  cache**, Edge TTL **Use cache-control header if present, bypass cache if not**, Browser TTL
  **Respect origin**, **Serve stale content while revalidating: On** (Cloudflare then answers from
  the stale copy inside the `stale-while-revalidate` window and refreshes in the background),
  status `500-599` → No store. Check with `curl -sI https://www.waimers.in/ | grep cf-cache` (a
  second request should say `HIT`).
- **Zero Drift theme, product preload** (layout head): it preloads `product.featured_media` at
  high priority, which is not the photo the page opens on when the default variant has its own.
  Changing it to `product.selected_or_first_available_variant.featured_media | default:
  product.featured_media` measured 4.15 → 4.01 s on top of the fix above (within noise). Theme
  edit in Edit code, owner's call.

## Follow-ups (not in this PR)

- React product pages ship ~430 KB gzip of Next chunks. The biggest avoidable one is
  `sanitize-html` + htmlparser2 (~64 KB gzip, 182 KB raw) in the browser, pulled in by
  `packages/blocks/src/richtext-html.ts` through `rich-copy.tsx` and `product-tabs.tsx`: sanitise
  on the server and pass HTML down, then re-measure. Sentry client (~34 KB) loads after `load`.
- Product page FCP (~3.8 s lab) is bandwidth-bound (≈1.1 MB before the image); the 83 KB global
  stylesheet and the theme's Noto Sans JP (89 KB CSS) are the next CSS candidates.
