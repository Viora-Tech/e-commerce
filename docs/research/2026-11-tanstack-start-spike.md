# Spike: admin Orders list on TanStack Start (9 Nov 2026)

**Question.** Would moving the admin from Next.js 16 to TanStack Start (Vite) make it lighter and
faster, and make builds cheaper? **Method.** The Orders list was ported to a new app,
`apps/admin-lab` (TanStack Start in SPA mode, Router file routes, Query through
`@orpc/tanstack-query`, the admin's own Table code), and measured side by side with the Next
admin on the same machine and the same local data (Waimers store, 1,289 orders).

**Answer: do not switch.** The full-port build would still peak at about 3.2 to 3.5 GB (not under
2 GB), and the page is not uniformly faster: it shows the first rows later, but becomes
interactive sooner and is much faster going back to the list. By the agreed rule (switch only
if build peak memory falls under about 2 GB and the page is at least as fast), both conditions
fail. Details and the cheaper wins worth taking instead are at the end.

## What was built

- `apps/admin-lab`: TanStack Start 1.169.4 (`spa: { enabled: true }`), React Router 1.170.46,
  React Query 5.107.1, `@orpc/tanstack-query` 1.15.4, Vite 8.3.6 (Rolldown), Tailwind 4 through
  `@tailwindcss/vite`, the same React Compiler (Babel preset). All versions pinned exactly.
- It imports apps/admin's own files unchanged through an `@/` alias: the AdminFrame shell
  (sidebar, top bar, palette, assistant), ResourceTable, order columns, filters, bulk actions,
  dialogs, copy and the oRPC client (`@/lib/api-client`). Only two files are new code:
  - `src/routes/_admin.tsx`: the `(admin)` layout as a client route. Session, stores and
    `store.shell` come from the API (`me`, Better Auth's `organization/list`, `store.shell`)
    instead of server reads.
  - `src/routes/_admin/orders.tsx`: `orders-page.tsx` with `initial` props replaced by
    `useQuery` calls. A route loader starts the same five reads `page.tsx` makes on the server
    (list, tab counts, tiles, app actions, facets), in parallel. Refetch on focus is on.
    Search, tabs, panel filters, sort, page and page size work as before (URL state through
    nuqs's TanStack Router adapter). Bulk actions and row menus are the admin's own.
  - TanStack Virtual is not used: the list is paginated at 100 rows at most, below the point
    where windowing pays off.
- Auth: the real session cookie. The lab's server (`serve.ts`, a stand-in for any static
  host) forwards `/api/*` to the admin, which still owns oRPC, Better Auth and webhooks. On
  localhost the cookie is shared across ports. The measurements used a session row created
  in the local dev database for the seeded owner. Nothing touched production.
- Not ported: `AccentStyle` (a server component reading `next/headers`), the plan-usage card in
  the sidebar, the bug-report host, CSP nonces.

### Shims (the migration-cost list)

Every Next import the Orders page and the shell reach, and what answered it:

| Next import | Files on this page and shell | Shim |
|---|---|---|
| `next/link` | 14 (order columns, row actions, header actions, sidebar, nav section, user menu, activity bell, ...) | `src/shims/next-link.tsx`: anchor + `router.navigate({ href })`, preload on hover |
| `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`, `useParams`, `redirect`, `notFound`) | 14 (resource table, bulk actions, app actions, admin frame, sidebar, palette, assistant, ...) | `src/shims/next-navigation.ts`. `router.refresh()` becomes "invalidate every query". |
| `next/dynamic` | 3 (palette host, assistant host, answer chart) | `src/shims/next-dynamic.tsx`: `React.lazy` + Suspense |
| `next/image` | 1 (sidebar logo) | `src/shims/next-image.tsx`: plain lazy `<img>` |
| `@sentry/nextjs` | 2 (browser errors, route error) | `src/shims/sentry.ts`: no-op stubs. A real port would use `@sentry/react`. |
| `nuqs/adapters/next/app` | 1 (root layout) | Swapped for `nuqs/adapters/tanstack-router` (no shim needed) |
| `next/font/google` | 1 (root layout) | `@fontsource-variable/*` packages |
| `next/headers`, `server-only`, server components | layout, `page.tsx`, `AccentStyle` | Rewritten as API calls in route loaders (not shimmable) |

That makes **5 shimmed modules across 34 importing files**, plus one adapter swap and one font
swap. Typecheck (`tsc`) of the lab with all reused admin files passes against the shims.

## Results

Same Windows PC (12 cores, 15.5 GB RAM), one heavy process at a time, local Postgres. Build
peaks are the summed working set of the whole process tree, sampled every second (on Windows
this counts shared pages more than once, which is why Next reads higher here than the Docker
figure of about 4.35 GB). Page timings: headless Chromium (Playwright), against the production
builds (`next start` and the lab's static build), median of 7 runs on desktop and 5 on mobile
(390 px wide, CPU slowed 4x). The first run of each set was a warm-up outlier and is included in
the raw numbers.

| Metric | Next admin | TanStack Start lab | Note |
|---|---|---|---|
| **Build, as measured** (cold) | 5.35 to 5.61 GB, 66 to 71 s (whole admin) | 1.35 GB, 15 s (Orders page plus shell only) | Not like for like: one page against 186 |
| **Build, full-port estimate** (all 1,488 admin `'use client'` modules bundled into the lab) | 5.35 to 5.61 GB, 66 to 71 s | **3.52 GB, 85 s** with the Babel React Compiler; 3.22 GB, 25 s without it | Still needs an API server (none to build if Bun runs the TypeScript) |
| JS, first load of Orders | 50 files: 2,524 KiB raw, 823 KiB gzip, 706 KiB brotli | 25 files: 2,060 KiB raw, 657 KiB gzip, 559 KiB brotli | About 20% less |
| CSS, first load | 2 files: 59 KiB gzip | 1 file: 60 KiB gzip | Same stylesheet |
| Requests, first visit | 111 | 47 | Next prefetches sidebar routes (RSC) |
| Desktop: rows visible, first visit | **316 ms** | 508 ms | Next streams rendered HTML; the SPA renders after its JS and API calls |
| Desktop: main thread quiet (interactive) | 672 ms | **465 ms** | Next's hydration is the long tail |
| Desktop: rows visible, reload | **337 ms** | 400 ms | |
| Desktop: back to list from an order | 235 ms | **164 ms** | Served from the Query cache |
| Desktop: first paint (FCP) | 248 ms | **192 ms** | |
| Mobile: rows visible, first visit | **1,149 ms** | 1,883 ms | |
| Mobile: main thread quiet | 2,821 ms | **1,813 ms** | |
| Mobile: rows visible, reload | **1,224 ms** | 1,510 ms | |
| Mobile: back to list | 1,499 ms | **973 ms** | |
| Server RSS, idle after start | 196 MB | 22 MB static server (plus the API server, below) | |
| Server RSS after 20 Orders loads | **731 MB** (pages + API in one Node process) | 314 MB API server (Next serving only `/api`) + 22 MB static | Server rendering costs about 400 MB here |
| First request after a server start | about 20 s (`/orders`) | about 11 s (first API call, also Next) | Windows, cold module loading |

The lab can be served with **no Node server at all**: `dist/client` is static files plus a
prerendered `_shell.html`, so nginx, Caddy or Cloudflare Pages would serve it, with the API on
its own process. That is the biggest runtime saving, and most of it comes from dropping server
rendering, not from Vite.

### Things found while measuring

- **TanStack Router holds a pending skeleton for at least 500 ms by default**
  (`defaultPendingMinMs`). In SPA mode the prerendered shell starts in the pending state, so the
  data, already loaded at about 200 ms, waited until about 575 ms. `defaultPendingMinMs: 0`
  (in `src/router.tsx`) cut first-visit time from 819 ms to 508 ms on desktop.
- Moving the shell's reads (`me`, stores, `store.shell`) into the layout's loader put all nine
  API calls in one parallel burst at about 80 ms (they had queued behind the first render).
- The SPA shell logs a React hydration mismatch (#418) on load. React recovers by rendering
  on the client, so it is harmless here, but a real port would need to fix it (theme script or
  skeleton markup differing between the prerender and the browser).
- The Babel React Compiler is most of the lab's build time (85 s against 25 s without it) but
  little of its memory. Vite's plugin also offers an experimental Rust compiler
  (`oxc-transform-react`), not tried here.

## Porting pain points

1. **Every server `page.tsx` becomes a loader.** All 186 pages are server components. 125 of
   them read data on the server (`appRouter` calls, `shell-data`, `getSession`). Each needs its
   reads turned into `queryOptions` and its `initial` props into `useQuery`. The Orders page was
   mechanical, but each page is its own small rewrite.
2. **`router.refresh()` changes meaning.** It appears 132 times. In Next it re-runs the server
   components. With Query it has to become "invalidate these keys". The shim invalidates
   everything, which works but refetches too much. Each call site should name its keys.
3. **The API needs its own server.** The admin's 26 route handlers (`/api/rpc`, Better Auth,
   webhooks, uploads, MCP, OAuth, `/api/v1`, health, GitHub, channels, ...) live inside Next.
   Without Next they need a small Bun/Hono server. The oRPC router and Better Auth are
   framework-agnostic, so this is plumbing, not a rewrite.
4. **`proxy.ts` and CSP.** The per-request script nonce has no static-host equivalent. A
   hash-based CSP or a tiny edge function would replace it. Redirects in `next.config.ts`
   (settings regrouping, marketing to growth, stock pages) move to the host or the router.
5. **Server-first features become client-first.** Language and region cookies are read in the
   browser (fine: Hindi already loads as its own chunk). The session redirect moves from the
   server to a client check. `metadata` (176 files) moves to route `head()`. `loading.tsx`
   (43) moves to `pendingComponent`. Error and not-found files (7) move to route options.
6. **Tailwind source scanning.** Next scanned `apps/admin` on its own; Vite needs an explicit
   `@source`.

## Effort to move all 186 routes

Rough figures for one developer working with AI help:

| Work | Estimate |
|---|---|
| Shims become permanent (`Link`, navigation, dynamic, image), plus Sentry on `@sentry/react` | 1 to 2 days |
| API server outside Next: oRPC, Better Auth, 26 route handlers, uploads, webhooks, health, Docker image | 4 to 6 days |
| 186 pages: loaders and queries (125 with server reads), `metadata` to `head()`, loading and error states; about 30 to 60 minutes each | 15 to 20 days |
| `router.refresh()` call sites (132) given proper query keys | 3 to 4 days |
| Auth redirects, CSP without nonces, redirects, i18n first paint, fonts | 2 to 3 days |
| Puck theme editor, GrapesJS email editor, PDF preview and other heavy client islands, checked under Vite | 3 to 5 days |
| QA of every page, Playwright smoke, release | 5+ days |
| **Total** | **about 7 to 9 weeks** (6 to 8 weeks if everything goes smoothly) |

## Risks

- **SSR needs.** The admin is private (noindex), so SEO is not a concern. The cost is the first
  paint of data: the SPA shows rows 190 ms later on desktop and about 730 ms later on a slow
  phone. Start can render on the server instead, but that brings back a Node server and most of
  its memory.
- **Auth and middleware.** Session checks move to the client plus the API. The CSP nonce,
  `Sec-Fetch-Site` checks and cookie scope need re-doing on the new host. The OAuth consent,
  MCP and login flows are server pages today.
- **i18n.** The Hindi overlay works client-side; there is a brief English flash risk if the
  cookie read and the chunk load are not ordered as `LocaleProvider` does today.
- **Sentry.** `@sentry/nextjs` covers server, edge and browser; it would become
  `@sentry/react` plus `@sentry/bun` (or `@sentry/node`), with source maps from Vite.
- **Puck theme editor.** Client-only and large; it should bundle under Vite, but its iframe
  previews and storefront block imports (`packages/blocks`) were not tried in this spike.
- **Two moving targets.** TanStack Start ships a release every few days (1.169.4 to 1.169.5
  while this spike ran); Next 16 is the known quantity here.

## Recommendation

**Stay on Next.js.** By the rule agreed for this spike:

- Build peak memory: a full port is estimated at about 3.2 to 3.5 GB locally, against 5.4 to
  5.6 GB for Next measured the same way. That is 35 to 40% lower, but well above the 2 GB bar.
  It would fit a 4 GB machine without swap, but so might further Next build tuning.
- Speed: mixed, not "at least as fast". The SPA becomes interactive sooner and goes back to a
  list much faster, but first shows its data later on every first visit and reload.

Worth doing in the current Next admin instead (each a small PR):

1. **TanStack Query for list pages inside Next.** The back-to-list win (235 to 164 ms desktop,
   1.5 to 1.0 s mobile) comes from the Query cache, not from Vite. Seeding Query with the
   server's `initial` data gets the same win without a migration.
2. **Fewer route prefetches.** Next made 111 requests against the lab's 47, mostly RSC
   prefetches of sidebar links; prefetching on hover only would cut those.
3. **Split the API out of the Next process later**, if server memory matters: serving only
   `/api` held at 314 MB against 731 MB with page rendering. That is a separate,
   framework-neutral change.

## Reproduce

```sh
# Lab (from apps/admin-lab): build, then serve with the admin running on :3200
bun run build && ADMIN_API=http://127.0.0.1:3200 bun serve.ts
# Full-port build estimate: list every admin client module, then build with them
bun stress/gen.ts && VITE_LAB_STRESS=1 bun run build   # LAB_COMPILER=off skips the React Compiler
# Page timings (session cookie value as the argument; add `5 mobile` for the phone profile)
bun stress/measure.ts "<better-auth.session_token>" 7
```

Next admin build used the Dockerfile's flags: `NODE_ENV=production BUILD_TYPECHECK=0
BUILD_CPUS=2 NODE_OPTIONS=--max-old-space-size=4096 bun run build`, with `.next` deleted first.
