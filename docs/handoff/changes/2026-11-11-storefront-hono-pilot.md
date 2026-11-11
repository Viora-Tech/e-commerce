# Storefront pilot: product page on Bun + Hono (roadmap speed track step 6, option B)

Branch `pilot/storefront-hono`, draft PR into `dev`. Research only: nothing in production
changes, nothing deploys it, no migration.

- **What:** `apps/storefront-hono/` serves `/products/:handle` of an imported Liquid theme store
  with the Next storefront's own modules (`apps/storefront/src/lib/*`: product loaders, the
  Liquid section render and its cache, `templateSections`, SEO, the plain HTML island). A Bun
  preload plugin (`src/preload.ts`) swaps `server-only` for an empty module, `next/headers` for
  a request context (`src/next-headers.ts`, AsyncLocalStorage) and `React.cache` for a
  per-request memo (`src/react-cache.ts`), so the shared code runs unchanged. Store from the Host header like the proxy (`src/routing.ts`), `STORE_ID` pins one.
- **Our product section** (`MainProduct`, React `ProductView`) is drawn with `renderToString`,
  with no hydration; a real port needs it as plain HTML plus a small script.
- **Run:** `cd apps/storefront-hono && bun run start` (port 3200, reads the root `.env`).
- **Checks:** `scripts/html-match.ts` (fetch A, fetch B, diff), `bench/product.js` (k6).
- **Results and recommendation:** `docs/research/2026-11-storefront-hono-pilot.md`. In short:
  504/504 sections and 72/72 head SEO blocks match `next start`. Cached, p50 is 45 ms against
  277 ms and throughput is 423 against 70 req/s at 20 users. Uncached, it is 11.2 against 8.1
  req/s. Memory is 287 against 373 MB at idle.
- **Next step (owner question):** hydrate `ProductView` as a small React island on the B page,
  then measure again.
- Left out on purpose: redirects, theme previews, password page, market subfolders, edge cache
  headers, theme assets, cart and every other page type (listed in the research note).
