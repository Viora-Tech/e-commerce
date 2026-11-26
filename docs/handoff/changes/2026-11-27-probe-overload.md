# Bot scans can no longer freeze the storefront

Branch `fix/probe-overload` (from `origin/dev`). No migration. New optional env
`STOREFRONT_RENDER_SLOTS` (default 4, `0` = no limit).

Background: on 26 Nov 2026 12:41-12:44 UTC a bot asked www.waimers.in for ~250 secret-file paths
(`/.env.production`, `/backup/db.sql`, `/.svn/entries`, `/site.zip`, `/compose.yaml`). Each one was
rewritten into the catch-all and rendered the full Liquid 404 under its own cache keys, the
container (cpuLimit 1.2) saturated, and a home-page load waited ~65 s.

## What changed

- **Cheap 404 for probes.** `isProbePath` in `apps/storefront/src/lib/routing.ts`: any dot segment
  except `/.well-known/`; endings `.env .sql .zip .tar .tgz .gz .bz2 .7z .rar .bak .orig .old .swp
  .php .asp(x) .jsp .cgi`; first segment `wp-*`, `xmlrpc.php`, `backup(s)`, `phpmyadmin`,
  `terraform*`, `(docker-)compose.y(a)ml`. `routeForStore` returns `forbidden`, so the proxy
  answers a plain-text 404 like the internal prefixes: no theme, no database. `/theme-assets/`,
  `/_next/` and `/api/` are never checked.
- **The theme's 404 renders once per theme version.** `routeForStore` flags a path whose first
  segment is no route under `app/-s/[storeId]/` (`STORE_ROUTE_SEGMENTS`) with `missing: true`; the
  proxy sets `x-missing-route: 1` (a derived header, stripped from clients). `requestScope` in
  `lib/liquid-theme.ts` then renders that request's Liquid as `/404` (`liquidRequestPath`,
  `lib/liquid-cache.ts`), so the layout, header, footer and 404 sections share one set of cache
  keys for every unknown path. The keys still carry the store stamp and theme version, so a
  publish or save shows at once. The Broken links tab still records the real path (it reads
  `x-pathname`).
- **Render queue.** `lib/render-gate.ts`: `RenderGate` (slots + priority queue), `RequestSlot`
  (one page's parts share one slot), `RenderTickets` (the proxy's per-request abort signal and
  priority, found by the `x-render-ticket` header). `lib/render-slot.ts` `withRenderSlot` wraps the
  two cache-miss render points in `liquid-theme.ts` (`renderLiquidSections`, `liquidLayoutFor`).
  Priority: `wc_cart`/`wc_customer` cookie = shopper (first), bot-like user agent (or none) =
  bot (last), anyone else in between. While anyone has waited 5 s (`BUSY_WAIT_MS`), the proxy
  answers crawler page requests with `503`, `Retry-After: 30`, `no-store` (never robots.txt,
  sitemaps, llms.txt or feeds). A visitor who disconnects leaves the line, and a section render
  under way stops before its next section (`RenderAbortedError`, which `instrumentation.ts` keeps
  out of Sentry and the error log).
- **Event-loop lag.** The ten-minute `storefront memory` line (`lib/memory-report.ts`) now carries
  `eventLoop: { p99Ms, maxMs }` (`monitorEventLoopDelay`, reset each line) and `renderQueue`. A
  `storefront render queue backed up` warning is logged when the queue stays non-empty for 3 s,
  at most every 30 s.
- Env plumbing: `packages/config/src/env.ts`, `deploy/docker-compose.prod.yml`, both env examples.
  Developer docs: `building/performance.mdx`, "Sizes and switches" and "Scans and unknown paths".

## Tests

- `apps/storefront/src/lib/routing.test.ts`: probe and real paths, the missing flag, and a check
  that `STORE_ROUTE_SEGMENTS` matches the route folders on disk.
- `apps/storefront/src/lib/render-gate.test.ts` (new): bot detection, slots, priority order,
  aborts, congestion, the queue warning, shared request slots, tickets.
- `apps/storefront/src/lib/liquid-cache.test.ts`, `memory-report.test.ts`: one key for all
  unrouted paths, event-loop stats.

## Left to do / for the owner to check

- On localhost: `/.env`, `/backup/db.sql`, `/wp-login.php` answer a plain `Not found`; `/nope`
  shows the theme 404 (and a second unknown path is fast); products, collections, cart, checkout,
  account and the sitemaps are unchanged.
- Under an imported theme, Liquid's `request.path` on a 404 page is now `/404` (canonical and
  language links on that page point there). A theme that prints the requested path on its 404
  page shows `/404`.
- A route folder added under `app/-s/[storeId]/` must be added to `STORE_ROUTE_SEGMENTS`
  (the routing test fails until it is).
- The 503 needs the queue to be backed up; the queue only bounds Liquid renders, not other
  database reads or React rendering.
