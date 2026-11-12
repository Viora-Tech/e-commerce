# Storefront server pilot: Next (A) vs Bun + Hono (B), product page

Roadmap, "Speed and memory track", step 6 (options A and B), and the "Long-term port" rule: a piece
switches only after it renders the same HTML and beats the old one on speed and memory. Measured
11 Nov 2026 on the dev PC (Windows 11, Bun 1.4.4, Node for `next start`), against the local
Postgres copy of Waimers (72 products, imported Horizon theme). Code: `apps/storefront-hono/`,
draft PR into `dev`.

## Update 12 Nov 2026: buy box island, store switch, side by side with Next

Branch `feat/storefront-hono-island` (draft PR into `dev`) takes the pilot to a shippable,
switched-off setup. The owner's decisions: **reuse the React buy box as a hydrated island** (no
rewrite in plain JS), and **run Hono beside Next, switched on store by store, with a fallback to
Next** for any error, unsupported page or store that is not switched on.

### Result in one line (12 Nov)

With the island, B still renders the **same sections as the production Next build (504 of 504,
`MainProduct` 72 of 72) and the same head SEO (72 of 72)**. The buy box now **works** (variant
pick, gallery, stock, add to cart, pre-order, notify-me, delivery check, the Reviews app widgets),
and the page loads **60 % less JavaScript** than Next's (163 KB against 410 KB gzip). Cached, B
answers at p50 52 ms (365 req/s at 20 users), uncached at 16 req/s, and keeps about 300 MB at rest.

### How hydration works

- **One tree, both sides.** `apps/storefront-hono/src/island/buy-box.tsx` is what the Next product
  route draws for `MainProduct`: `ProductView` with the same props (`EmiOffersProvider`,
  `RecordView`, `DeliveryEstimateWidget`, `NotifyMeForm`, the EMI line), inside
  `MoneyFormatProvider` (the store's price format and market pricing, as Next's layout gives it),
  plus the Reviews app's widget and carousel through `LiquidAppBlock`, which the Next page and
  layout portal into the theme's `reviews` and `reviews-carousel` slots. The server renders it
  with `renderToReadableStream` (all lazy pieces in), the browser hydrates the same tree.
- **Placed exactly where Next has it.** The section goes through the same block config and Puck
  data pass as before, with a mark where the buy box goes (`island/place.ts`); the island's HTML
  replaces the mark. Only when the mark is all the section drew (or all its `section-frame`
  holds) is the page drawn; anything else beside it sends the page to Next (`island-shape`). React's
  image preload links move into `<head>`, as Next does.
- **Props in the page.** `island/props.ts` writes them as JSON in
  `<script type="application/json" id="hono-island-props">` (`<` escaped, so no value closes the
  script). A value JSON would change (a `Date`, a `Map`, a function, `NaN`) refuses the page
  (`island-props:<what>`) so the browser never hydrates other props than the server rendered.
  Functions Next passes as props travel by name (`underPrice: 'emi-offers' | 'emi-hint'`,
  `notifyMe`). Typical size: 8.6 KB per page, against 36 KB of RSC payload on Next.
- **Server actions.** A browser bundle cannot run Next's server actions, so the island build swaps
  `@/lib/cart-actions`, `@/lib/shipping-actions` and `@/lib/back-in-stock-actions` for
  `island/actions.ts`, which posts JSON to `/theme-actions/island-add|island-delivery|island-notify`
  on the store's origin. Next answers those with the very same actions
  (`apps/storefront/src/lib/hono-island/actions.ts`; JSON only, same origin). An add opens the cart
  page, as `ThemeCartAdded` does on Next; the Pixels `ViewContent` fires as `PixelTrack` does.
- **The bundle.** `bun run build:island` (`scripts/build-island.ts`, Bun.build, ESM, minified, code
  split) writes `dist/island/` with hashed names and a manifest. Anything that reaches
  `server-only` fails the build. It also compiles the storefront's `globals.css` (Tailwind and the
  blocks' CSS) the way Next does, since our buy box's CSS lives there: the pilot never linked it
  (its HTML match dropped `/_next` links), so its buy box would have been unstyled.
  The page loads `/api/hono-island/<file>` (`<script type="module" nonce>`), which Next passes on
  from the service with a year's `immutable` cache.

| File | Raw | Gzip | Loaded |
| --- | --- | --- | --- |
| `client-*.js` (React DOM, `ProductView`, the widgets) | 478 KB | 163 KB | every product page |
| `chunk-*.js` (the phone field's country list, `react-phone-number-input`) | 407 KB | 103 KB | only when the notify-me form shows its phone field |
| `global-*.css` (Next's own global stylesheet, compiled the same way) | 541 KB | 83 KB | every product page (Next ships the same 554 KB file) |

JavaScript a product page loads up front (`pulsar-hyperion-pro`, theme scripts excluded, both
sides load the same ones):

| | Script files | Raw | Gzip | Inline scripts |
| --- | --- | --- | --- | --- |
| A Next (production image 66709261b) | 17 | 1 225 KB | 410 KB | 104 KB |
| **B Hono + island** | **1** | **478 KB** | **163 KB** | 70 KB |

Most of B's script is React DOM (about 60 KB gzip) and `sanitize-html` with `postcss` (about 45 KB
gzip), which `RichCopy` uses to clean the accordion and payment-note copy in the browser. Taking
that out (sanitising on the server and swapping the module in the island build) is the next easy
cut; it was left out here because a remounted panel would then show unsanitised HTML.

### Where the store switch lives

`store.preferences.delivery.honoProduct` (`packages/core/src/online-store/preferences.ts`),
next to the plain HTML path's `delivery.plainHtml`. Off by default for every store; no migration
(preferences are JSON, parsed with defaults). The proxy reads it through `storefrontLock` (cached
10 s per process).

- **Owner only.** Online store › Preferences shows a "Faster product pages (beta)" card
  (`components/preferences/hono-product-card.tsx`, English and Hindi) to the store owner alone.
  It saves through the usual preferences save (`store.updatePreferences`, Online store write), and
  the API keeps the switch as stored for anyone who is not the owner
  (`keepOwnerOnlyPreferences`), so another member's save neither changes nor clears it.
- **One browser, before shoppers.** The same card has "Try it in this browser first": a storefront
  link `/?hono=<token>`, where the token is signed by the API for the owner only
  (`honoPreview.token`, HMAC with `SETTINGS_SECRET`, this store, one hour). The proxy turns a
  valid token into the cookie `wc_hono=on` for that browser and redirects to the same page without
  the param. That browser then gets Hono product pages even while the store's switch is off.
  An unsigned `?hono=on`, another store's token or an expired one changes nothing, so a shared
  link turns nothing on for anyone else (tested). `?hono=off` opts a browser out (anyone may, for
  themselves), `?hono=clear` (the card's "Stop trying" link) goes back to following the switch.
  Both cookies are `wc_` cookies, so pages for that browser are never stored in the shared edge
  cache.

### Routing and fallback

```
shopper → Cloudflare → storefront (Next, unchanged entry point)
   proxy.ts: store on (or wc_hono=on)? STOREFRONT_HONO_URL set? GET /products/<handle>? breaker closed?
     no  → the Next page, as today
     yes → rewrite to /-x/<store>/products/<handle> (internal, a shopper cannot reach it)
           app/-x/.../route.ts → fetch the service (timeout 3 s, signed headers)
              200 + x-storefront-render: hono + text/html → that page
              anything else (error, timeout, 404, 501 skip, other status)
                → the Next page through this same server (the plain path's signed hand-back),
                  with x-hono-fallback: <reason>
```

- **Why this way.** Next stays the only entry point: Cloudflare, Traefik and the tunnel do not
  change, every store not switched on runs exactly today's code path, and Next keeps doing what
  the service does not yet (redirects, market moves, the password page, previews, the
  order-token swap, cookies, CSP headers, edge-cache headers). The service is the smallest thing
  that can fail, and when it does, the shopper gets the Next page. The cost is that a Hono page
  still passes through Next's proxy and a route handler (no React render), so Next's memory does
  not go away until more page types move.
- **What goes to the service** (`lib/hono-island/route.ts`, `wantsHono`): GET or HEAD
  `/products/<handle>` of a store with the switch on, while `STOREFRONT_HONO_URL` is set; never a
  client navigation (`RSC`), a theme preview, a form result, a referral landing, a subfolder market,
  `?view=` / `?review=` / `?write=`, a browser with `wc_hono=off`, or a page handed back. A
  browser with `wc_hono=on` (the owner's preview) gets it while the store's switch is off.
- **What the service refuses** (501 with `x-plain-skip-reason`, Next draws it): any section of
  ours other than one `MainProduct`, an A/B theme test, an enabled app embed, an app block slot
  other than the two Reviews ones, a theme buy button that gets the pre-order note, props that do
  not survive JSON, no built island.
- **Trust.** Next signs each forward (`x-hono-forward`: HMAC of store, host and the outer nonce
  with `SETTINGS_SECRET`). The service trusts the store, market and path headers only then, writes
  the page with Next's nonce, and sets no CSP itself (Next's outer response carries it). An
  unsigned request is answered only outside production (or `STOREFRONT_HONO_DIRECT=1`); a forged
  one gets 403.
- **Breaker.** Five failures in a row (errors, timeouts, 5xx; not skips or 404s) rest the service
  for 30 s per Next process, so a down service costs at most five slow pages, not every one.

### Measurements, 12 Nov (same method as below)

Same PC, same database copy, k6 with the same 10 handles, no think time, 30 s per run after a
warm-up of 30 requests; memory is the working set of the server process, sampled every second.
B ran directly (Bun, `bun run`, as in the pilot). The PC had 1.2–2.5 GB free during the runs.

| B Hono + island | Users | p50 | p95 | p99 | req/s | Errors | Idle → peak memory |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cache on | 20 | 52 ms | 66 ms | 124 ms | 365.6 | 0 % | 297 → 497 MB |
| cache on | 100 | 253 ms | 352 ms | 1 630 ms | 342.7 | 0 % | 297 → 646 MB |
| cache off | 20 | 1 220 ms | 1 330 ms | 1 410 ms | 16.2 | 0 % | 307 → 484 MB |
| cache off | 100 | 5 820 ms | 5 980 ms | 5 990 ms | 17.1 | 0 % | 315 → 786 MB |

A single uncached page alone takes 0.14 s (0.2 s in the pilot).

Against the pilot's B (no island): cached throughput is about 14 % lower (365 against 423 req/s at
20 users), the cost of rendering the island through a stream and writing its props; uncached
throughput is higher (16.2 against 11.2 req/s), most likely #1530's request memo, which works here
because the preload's `React.cache` swap gives it a per-request map.

Against Next (A): `next build` (3.6 GB peak) could not run on this PC today (under 2.5 GB free),
so the pilot's A figures (11 Nov, native `next start`, same method) remain the comparison:
cached p50 277 ms and 69.6 req/s at 20 users, 74.4 req/s at 100; uncached 8.1 and 9.4 req/s;
373 MB idle, 760–777 MB peak. As a same-day check, the production storefront image (66709261b)
in Docker, capped at 768 MB like production, gave p50 355 ms, p95 408 ms and 54.9 req/s at 20
users cached, with 301 → 365 MB (Docker adds its own network hop, so read it as a floor for A).

| Cached, 20 users | p50 | req/s | Peak memory |
| --- | --- | --- | --- |
| A Next (pilot, native) | 277 ms | 69.6 | 760 MB |
| A Next (12 Nov, Docker) | 355 ms | 54.9 | 365 MB (container) |
| **B Hono + island** | **52 ms** | **365.6** | **497 MB** |

### HTML match, 12 Nov

`scripts/html-match.ts` over all 72 product URLs, A = the production storefront image
(66709261b), B = this branch: **504 / 504 sections equal** (header, 2 template sections, 3 footer
sections, `MainProduct` 72 / 72) and **72 / 72 head SEO blocks**. The whole document still differs
by design (Next's runtime and RSC payload; B's island props and script).

### Checked in a browser (B direct)

Hydration without console errors; the variant picker moves price, stock bar and gallery; the
Reviews widget and carousel fill their theme slots. Add to cart, delivery check and notify-me call
`/theme-actions/island-*`, which only Next answers, so they were checked by the route's tests and
the forward contract by hand (a signed forward gets the page with the outer nonce and the shopper's
host in the canonical; a forged token or another host gets 403). The end-to-end path through Next
is the owner's preview on production (runbook step 4): there is no test server.

## Rollout runbook

Nothing below is done by the PR; it ships switched off. There is no test server: the end-to-end
check is the owner's own browser on production (step 4), before any shopper sees it.

1. **ECR repo** `vextro/storefront-hono` (same lifecycle policy as the others,
   `deploy/codebuild/README.md`). From then on every release builds and pushes the image with the
   others, tag = the release sha (`deploy/codebuild/build-images.sh`; until the repo exists the build
   skips it). The Dockerfile builds from the repo root like the other apps; no `next build`, the
   heavy step is `bun install`.
2. **Dokploy service** (internal only: no domain, no Traefik route), image
   `<registry>/vextro/storefront-hono:<sha>`, on `dokploy-network`, memory limit **768 MB**
   (measured: about 300 MB at rest, 650 MB peak at 100 users cached, 790 MB uncached), port 3200,
   health check `GET /healthz`. Environment: **copy the storefront service's environment**. The
   service runs the storefront's own modules and validates the same env schema (`loadEnv`), so it
   needs what the storefront needs: `DATABASE_URL` (plus `DATABASE_URL_DIRECT` and
   `DATABASE_POOLED` when pooled, for the render cache's LISTEN), `REDIS_URL`,
   `STOREFRONT_CACHE_MB`, the image and domain settings, and `SETTINGS_SECRET`, which **must**
   match the storefront's because it signs every forward. Do not copy `STOREFRONT_HONO_URL` (it is
   the storefront's setting). `NODE_ENV=production` and `PORT=3200` come from the image.
   Then put its app id in SSM `/vextro/deploy/dokploy-app-id-storefront-hono` so releases deploy
   it (before the storefront); unset, releases skip its deploy. The compose file's `hono` profile
   describes the same service for a compose setup.
3. **Point the storefront at it.** On the storefront service set
   `STOREFRONT_HONO_URL=http://<storefront-hono service name>:3200` (its name on `dokploy-network`)
   and redeploy. Every store is still off and no browser has the cookie: nothing changes for
   shoppers. Optional: `STOREFRONT_HONO_TIMEOUT_MS` (default 3000).
4. **Owner's preview on production.** Online store › Preferences › Faster product pages (beta) ›
   "Try it in this browser first". In that browser, product pages answer
   `x-storefront-render: hono` (devtools, Network, the document's response headers). Check add to
   cart, variant pick, a pre-order product, notify-me on a sold-out variant, the delivery check and
   the reviews widget. A page that says `x-hono-fallback: <reason>` was drawn by Next, which is
   fine and tells you why. "Stop trying in this browser" ends it.
5. **Switch the store on** with the toggle on the same card and save (owner only). It reaches
   every product page within about 10 s plus the edge TTL (30 s by default, or purge). From a
   shell: `curl -sI https://<store>/products/<handle>` shows `x-storefront-render: hono`.
6. **Watch** the `x-hono-fallback` rate and the service's logs (`[storefront-hono]` lines) for a
   day before switching on another store.

**Roll back**, fastest first:

- One store: the toggle off (or the SQL below with `false`). Within about 10 s plus the edge TTL.
- Everyone: unset `STOREFRONT_HONO_URL` on the storefront and redeploy it; or just stop the
  service (every product page falls back to Next; the breaker keeps the cost to five slow pages per
  process every 30 s, so stopping it is safe but unsetting the URL is cleaner).
- One browser: `?hono=off` on any page (or `?hono=clear` to follow the switch again).
- The code: revert the PR; with the switch off and no cookie it never runs.

Without the admin, as the database owner:

```sql
update store
set preferences = coalesce(preferences, '{}'::jsonb)
  || jsonb_build_object('delivery',
       coalesce(preferences->'delivery', '{}'::jsonb) || '{"honoProduct": true}'::jsonb)
where id = '<store id>';
```

## Result in one line (11 Nov pilot)

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
  Add to cart do nothing in B. Everything else on the page is plain HTML from Liquid. (Hydrated
  since 12 Nov: see the update at the top.)

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

## Questions for the owner (answered 12 Nov)

- The buy box is a **hydrated React island** (no plain JS rewrite).
- B runs **beside Next**, switched on **store by store**, with a **fallback to Next**. See the
  12 Nov update at the top.

## Reproduce

```sh
# B
cd apps/storefront-hono && bun run start              # builds the island, then port 3200, root .env
bun run test                                          # island props and placement
# A from the production image when `next build` does not fit (DATABASE_URL to host.docker.internal)
docker run --rm -p 3100:3100 -m 768m --env-file docker.env <registry>/storefront:<sha>
# A (from the real path, not a subst drive)
cd apps/storefront && bun run build && bun run start  # port 3100
# HTML match
bun scripts/html-match.ts fetch http://localhost:3100 out/a handles.txt
bun scripts/html-match.ts fetch http://localhost:3200 out/b handles.txt
bun scripts/html-match.ts diff out/a out/b
# Load
k6 run -e BASE=http://localhost:3200 -e VUS=20 -e DURATION=30s -e HANDLES=a,b,c bench/product.js
```
