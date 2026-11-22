# Section rendering on page URLs (`?section_id=`, `?sections=`)

**What:** An imported theme's script asking a page URL for one section
(`/collections/all?filter.v.availability=1&section_id=guide-results`, the Waimers "Ships today"
strip's in-stock count) got the whole page (about 620 KB) whenever the request did not pass
through our shim's `window.fetch` (a crawler, a script holding its own fetch, a curl). The proxy
now rewrites any storefront GET or HEAD page request carrying `section_id` or `sections` to
`/theme-actions/section` with the page's own path as `path` (`toSectionRendering` in
`apps/storefront/src/lib/section-rendering.ts`). The answer is only that section in Shopify's
wrapper (`<div id="shopify-section-<id>" class="shopify-section">`), JSON `{ id: html }` for
`?sections=a,b`, and 404 for a section the theme does not have, as on Shopify. The page's
filters, sort and page go along (`x-listing`), and the response takes the page's own edge
cache-control, since the proxy decides it from the page path.

**Fix (same day):** the first version passed the page path as `?path=` on the rewrite, but a
route handler reached by a proxy rewrite reads the URL the visitor asked for, so the section
rendered on the home page (`data-results-count="0"`). The proxy now hands the path on in the
`x-section-path` request header (a derived header, stripped from visitors), and the route reads it
before the shim's `?path=` (`sectionPagePath`). `section-rendering-proxy.test.ts` runs the proxy.

Left alone: `/search/suggest`, `/recommendations/*`, `/theme-actions/*`, checkout, account and
file paths (`.json`, `.js`) still answer themselves. The shim still routes theme fetches straight
to the section route.

`filter.v.availability=1` already counts in-stock products: live gives 45 in stock, 207 out of
stock, 252 in all.

`proxy.ts` is back to 500 lines: `visitorCountry` and the theme-version id check moved to
`lib/routing.ts`.

**Not ours:** after JS the home page has two `<h1>`s because the theme's `hero-carousel.js` (line
101) clones the first slide, including the theme section's visually hidden `<h1>`, for its loop.
That is theme code, so a fix belongs in the theme (strip or demote the `h1` in the clone).

**Check:** `cd apps/storefront && bunx vitest run src/lib/section-rendering.test.ts`. On a store:
`curl -s "https://<store>/collections/all?filter.v.availability=1&section_id=guide-results"` returns
a short `shopify-section-guide-results` div with `data-results-count`, not the page.
