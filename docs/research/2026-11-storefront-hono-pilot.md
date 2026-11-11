# Storefront server pilot: Next (A) vs Bun + Hono (B), product page

Roadmap, "Speed and memory track", step 6 (options A and B), and the "Long-term port" rule: a piece
switches only after it renders the same HTML and beats the old one on speed and memory. Measured
11 Nov 2026 on the dev PC (Windows 11, Bun 1.4.4, Node for `next start`), against the local
Postgres copy of Waimers (72 products, imported Horizon theme). Code: `apps/storefront-hono/`,
draft PR into `dev`.

## Result in one line

On the same requests, B rendered the **same theme and product markup** (504 of 504 sections, 72
of 72 head SEO blocks). B also used **25–45 % less memory**. With the render cache on, B was
**6× faster** (p50 45 ms against 277 ms, 423 against 70 requests per second at 20 users).
Uncached, B was **1.4× faster** (11.2 against 8.1 requests per second). The whole document is
not the same, and that is by design: B sends no Next runtime, no RSC payload and no React
hydration. That last point is the real cost of the port (see "What a full port takes").

## What B is

- `apps/storefront-hono/src/server.ts`: Hono on `Bun.serve`, one route, `/products/:handle`.
- It reuses the Next storefront's own modules, unchanged: `getProductByHandle`, the
  `storeRead` render cache, `templateSections`, `renderLiquidSections` (LiquidJS and our Shopify
  filters), `liquidLayoutFor`, `productGraph` / `marketCanonical`, the plain HTML island
  (`lib/plain-html/islands.ts`) and the proxy's `resolveHost`, `pickMarket`, `marketHeaders` and
  `scriptCsp`. No filter or loader was rewritten.
- `src/preload.ts` (Bun plugin, loaded from `bunfig.toml`) swaps three things so that Next-only
  imports work:
  - `server-only` becomes an empty module.
  - `next/headers` becomes `src/next-headers.ts`, which reads the request from an
    AsyncLocalStorage.
  - `react`'s `cache` becomes a per-request memo (`src/react-cache.ts`), which is what
    `React.cache` gives a Next server render.
- Store from the Host header with the proxy's resolver (`localhost` resolves to Waimers);
  `STORE_ID` pins one store.
- The document is built the way `lib/plain-html/render.ts` already builds the home page: the
  theme layout, the header group, `<main>` with the JSON-LD and the template's sections, the
  footer group, and the island script.
- **The one React piece:** Waimers' product template starts with our own `MainProduct` section
  (the React `ProductView` gallery and buy box) rather than the theme's `main-product`. B draws it
  with `react-dom/server` `renderToString`, through the same Puck config and `renderBlock` call as
  `renderTemplate`, so the markup is the same. It is **not hydrated**, so its variant picker and
  Add to cart do nothing in B. Everything else on the page is plain HTML from Liquid.

Not in the pilot: primary-domain, market and URL redirects, order-token swap, theme previews,
the password page, edge-cache headers, `/theme-assets/*` and every other route.

## Method

- **HTML match** (`apps/storefront-hono/scripts/html-match.ts`). All 72 product URLs were
  fetched from A (`next start`, production build) and then from B, one server at a time, with no
  cookies (a signed-out shopper with an empty cart, the case the cache serves). Before comparing,
  the script removes what changes on every request or build:
  - nonces and the port;
  - Next's per-request `data-liquid-slot` ids, its chunk scripts and the RSC payload pushes;
  - React's `<!-- -->` text separators;
  - image preload links, which Next hoists into `<head>` and `renderToString` leaves in place.

  It then compares each `shopify-section-*` element and our `MainProduct` block, the head SEO
  tags (title, description, canonical, og:title, og:image, JSON-LD), and the whole document.
- **Load** (`apps/storefront-hono/bench/product.js`, k6 1.x): 10 product handles in rotation, no
  think time, 20 and then 100 virtual users, 30 s each, after a warm-up of 30 requests. The same
  `.env` and database were used for both servers. Each server was run with `STOREFRONT_CACHE_MB=48`
  (cache on, the default) and with `STOREFRONT_CACHE_MB=0` (cache off: every request reads
  Postgres and renders all Liquid).
- **Memory** is the working set (Windows RSS) of the server's whole process tree, sampled every
  second: "idle" after the warm-up, "load" as the peak during each k6 run. A's tree is the
  `bun run` wrapper plus the `next start` Node process. B is a single Bun process.
- The PC was shared with other agents, so free memory varied between 0.3 and 4 GB. Every run in
  the tables below started with at least 1 GB free and never fell under 0.6 GB. Run-to-run noise
  is roughly ±10 %. The gaps reported here are much larger than that.

## Results

### HTML match (72 product pages, A = `next start` production build)

| Part | Equal |
| --- | --- |
| Theme sections (header, 2 product-template sections, 3 footer sections) | 432 / 432 |
| Our `MainProduct` section (`ProductView` markup) | 72 / 72 |
| All sections | **504 / 504 (100 %)** |
| Head SEO (title, description, canonical, og:title, og:image, JSON-LD) | **72 / 72 (100 %)** |
| Whole document after normalising | 0 / 72 |

The whole document differs for structural reasons, not content:

- **A carries Next's runtime:** about 17 `/_next/static` chunk scripts and, on average, 36 KB of
  inline RSC payload per page. That payload is what hydrates `ProductView`.
- **The theme's `layout/theme.liquid` head goes in different places.** A injects it at the top of
  `<body>` through `LiquidHtml`; B writes it in `<head>`, as the plain HTML path already does
  for home.
- **Each server adds its own small pieces.** A adds React-only pieces (`LiquidBoot`, the
  `LiquidReviewsCarousel` / `LiquidAppBlock` / `LiquidPreorderNote` portals, which render nothing
  on the server). B adds the plain HTML compat style and the island script.
- Average page size: A 321 KB, B 304 KB.

One fix was needed during the pilot: B escaped `'` differently from React in 3 descriptions.
It now escapes the way React does.

### Speed: render cache on (`STOREFRONT_CACHE_MB=48`)

| Server | Users | p50 | p95 | p99 | req/s | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| A Next (`next start`) | 20 | 277 ms | 343 ms | 694 ms | 69.6 | 0 % |
| **B Bun + Hono** | 20 | **45 ms** | **60 ms** | **71 ms** | **423.4** | 0 % |
| A Next (`next start`) | 100 | 660 ms | 6 984 ms | 10 260 ms | 74.4 | 0 % |
| **B Bun + Hono** | 100 | **208 ms** | **262 ms** | **1 802 ms** | **409.7** | 0 % |

### Speed: render cache off (`STOREFRONT_CACHE_MB=0`)

| Server | Users | p50 | p95 | p99 | req/s | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| A Next (`next start`) | 20 | 2 441 ms | 2 628 ms | 2 718 ms | 8.1 | 0 % |
| **B Bun + Hono** | 20 | **1 770 ms** | **1 932 ms** | **2 059 ms** | **11.2** | 0 % |
| A Next (`next start`) | 100 | 10 597 ms | 10 773 ms | 10 829 ms | 9.4 | 0 % |
| **B Bun + Hono** | 100 | **7 413 ms** | **7 682 ms** | **7 794 ms** | **13.3** | 0 % |

The uncached latencies are queueing: both servers render on one thread. A single uncached
request alone takes about 0.2 s on B. Live, the Next server takes 0.7–1.2 s, behind Cloudflare
and with real traffic.

### Memory (process tree working set)

| Server | Cache | Idle (after warm-up) | Peak at 20 users | Peak at 100 users | After load |
| --- | --- | --- | --- | --- | --- |
| A Next | on | 373 MB | 760 MB | 777 MB | 734 MB |
| **B Hono** | on | **287 MB** | **576 MB** | **624 MB** | **373 MB** |
| A Next | off | 477 MB | 817 MB | 1 157 MB | 995 MB |
| **B Hono** | off | **271 MB** | **422 MB** | **584 MB** | **293 MB** |

A's idle figure here matches the 355 MB per replica measured live. B keeps about 270–290 MB at
rest, even though it loads the same storefront modules plus React for the one section. It also
gives memory back after load, which A did not do within the 5 s window.

### Build and start

| | A Next | B Hono |
| --- | --- | --- |
| Build | `next build` (compile + generate): **58 s, peak 3.6 GB** process tree | **none**: Bun runs the TypeScript directly |
| Start to first product page | about 4 s | about 2–3 s (first cold start on this PC about 35 s, while Bun's transpile cache was empty) |
| Type check | part of the monorepo `typecheck` | `bun run typecheck` in `apps/storefront-hono`: 0 errors |

A `next build` needs about 3.6 GB at its peak. On this 15.5 GB PC that had to wait for a quiet
moment, and the first attempt was stopped by the memory watchdog. B has no build step, which
also helps the "admin in 4 GB without swap" image-build goal. `next build` must not run from a
`subst` drive: Turbopack's externals tracing writes `./P:/...` paths and fails.

### For reference: Next in dev mode

Before the production build fitted in memory, A was first measured with `next dev`. That run was
not a fair comparison and is not used above. With the cache on: p50 3.8 s, 4.6 req/s at 20
users, and about 3.0 GB of memory at idle. With the cache off: 1.1 req/s at 20 users, and at
100 users no request finished within 30 s.

An earlier B run without the per-request `React.cache` memo was also slower:

- cache on: 244 req/s, p50 76 ms;
- cache off: 7.4 req/s.

The memo matters because `requestScope`, `storeStamp` and the catalog id are read many times per
page.

## Why B is faster

- **No RSC round trip.** A renders a React Server Component tree, serialises it into the flight
  payload, renders HTML from that, then interleaves the payload into the response (36 KB per page
  here). B joins strings.
- **The expensive work is shared.** Both servers use the same Liquid engine, render cache and
  Postgres reads. That is why the uncached gap (1.4×) is much smaller than the cached gap (6×):
  uncached time is mostly Liquid and database work, which B runs too.
- **Bun's runtime is lighter.** It uses less memory at rest and has no Next server, router or
  middleware layers.

## What a full port takes

Today's storefront has 38 pages, 36 route handlers, 27 server-action modules and 114 client
components, plus the proxy (429 lines).

| Piece | What it needs | Rough size |
| --- | --- | --- |
| Product page | The **`ProductView` buy box** (gallery, variant picker, Add to cart, delivery estimate, notify-me, EMI, pre-order note, reviews widget) needs an island: either ship React for that one widget (a small client bundle hydrating `ProductView`), or rewrite it as plain HTML plus vanilla JS like the plain HTML islands. The decision rule needs the same HTML, so a hydrated React island is the faster path to an exact match. | 1–2 weeks |
| Collection, search, blog and article pages, `/pages`, home (Liquid stores) | The same pattern; home and `/pages` already exist as `lib/plain-html/render.ts`. Collection filters and sort go through `x-listing`, which the Liquid engine already reads. | 1–2 weeks |
| Stores on our own themes (Puck blocks, not Liquid) | 25 section types and about 70 block components are React. Either keep `renderToString` on the server (React stays on the server, with no RSC) or port each block. | 2–4 weeks if React stays on the server; months to port all blocks |
| Cart, checkout, account, order pages | Heavy client React (`use-checkout-form`, payments, OTP sign-in) talking to 27 server-action modules. The actions become JSON endpoints (the oRPC contract in the roadmap), and the pages stay React islands or become separate small apps. | 4–6 weeks; money rules last, each shadowed |
| Proxy and middleware | Host and market resolution, redirects, order-token swap, preview, password page, CSP, edge cache, referral and visitor cookies. These move into Hono middleware, reusing the same `lib/*` functions as the pilot does. | 3–5 days |
| Route handlers | `/theme-assets`, `/api/*` (beacon, vitals, px, search suggest, islands), sitemap, robots, feeds, theme actions. Most are already plain `Request → Response` functions, so they move as they are. | 1 week |
| Images | Shopper images already use our own media variants (`attachImageMedia`, `<picture>` with AVIF/WebP). `next/image` remains in 5 files (blog and CMS images), which would move to the same variants or a small resize route. | 2–3 days |
| `next/headers`, `React.cache`, `server-only` | Solved by the pilot's preload swap; a full port keeps it or replaces the imports with a small `@commerce/request` module. | done in the pilot |

Together, about 2–3 months for one developer for everything. Product, collection and the Liquid
pages, which are most of the traffic, would take about 3–4 weeks.

## Recommendation

1. **Option B passes the decision rule for the product page of an imported-theme store, with one
   condition.** The content HTML matches exactly (100 % of sections and SEO tags), and B wins on
   every speed and memory measure. The condition is that the page also needs the `ProductView`
   island hydrated, or it is not functionally the same page. Next step: ship `ProductView` as a
   small React island bundle on the B page and re-run this match and benchmark. If it still wins,
   B can serve Liquid product pages, behind the same proxy-level switch the plain HTML path uses
   (`lib/plain-html/route.ts`), with a fallback to Next for anything it cannot draw.
2. **Do it as an extension of the existing plain HTML path**, not as a big-bang rewrite. Every
   page type moves only after its own match and benchmark, as the roadmap rule says. This pilot's
   preload swap lets the Next and Bun servers share one codebase during the move.
3. **Option C (Rust) has to beat these B numbers, not Next's.** A cached B page already answers
   in about 45 ms, and an uncached one in about 0.2 s on its own. The uncached gap is in Liquid
   and Postgres, which a Rust port would have to rewrite (liquid-rust plus every filter) to
   improve. Measure C against B before committing to it.
4. **Option D (edge cache) still matters most for shoppers.** Behind Cloudflare most pages never
   reach either server; B mainly saves memory (about 90–190 MB per replica at rest, more under
   load) and cuts the uncached time.

## Questions for the owner

- Is a hydrated **React island for the buy box** acceptable on the "plain HTML + CSS + JS" page,
  or must `ProductView` be rewritten in plain JS before B can switch? The island is faster to
  ship and keeps the HTML identical. A rewrite drops React from the client too, but needs its own
  match check.
- Should B run as a second service next to Next (the proxy sends the pages it can draw), or
  replace the Next storefront store by store?

## Reproduce

```sh
# B
cd apps/storefront-hono && bun run start              # port 3200, root .env
# A (from the real path, not a subst drive)
cd apps/storefront && bun run build && bun run start  # port 3100
# HTML match
bun scripts/html-match.ts fetch http://localhost:3100 out/a handles.txt
bun scripts/html-match.ts fetch http://localhost:3200 out/b handles.txt
bun scripts/html-match.ts diff out/a out/b
# Load
k6 run -e BASE=http://localhost:3200 -e VUS=20 -e DURATION=30s -e HANDLES=a,b,c bench/product.js
```
