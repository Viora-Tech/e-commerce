# Storefront as plain HTML with islands

Status: phase 1 shipped behind a per-store switch (off by default). Written 9 Nov 2026.

## Why

Pages must open in about a second on a phone and be easy for search engines to read. Today every
storefront page is a Next.js React page, also for an imported Shopify theme, where the Liquid engine
has already produced finished HTML. On Waimers (imported Zero Drift theme) every page therefore
carries, on top of the theme's own files:

| Measured on www.waimers.in, 9 Nov | Home | /pages/about | /pages/faq |
|---|---|---|---|
| Next/React JS (15 files) | 1,182 KB raw, 390 KB gzip | same | same |
| Our global stylesheets (2 files, our own theme's section CSS) | 591 KB raw, 89 KB gzip | same | same |
| RSC data inline in the HTML | 105 KB | 101 KB | 99 KB |
| HTML document | 794 KB raw, 110 KB gzip | 522 KB, 79 KB gzip | 492 KB, 71 KB gzip |
| The theme's own JS | 339 KB raw, 114 KB gzip (33 files) | 226 KB (24) | 212 KB (21) |
| The theme's own CSS | 606 KB raw, 180 KB gzip (34 files) | 343 KB (20) | 308 KB (15) |

None of the first three rows is needed by a Liquid theme. They cost download, parse and
hydration time on every page (TBT 600-950 ms on the heaviest pages, see the 353-page audit), and
the React hydration step is also why theme scripts have to be parked until React is done
(`lib/liquid-defer.ts`), which delays every theme effect.

## How Shopify does it

Sources opened for this doc:

- **Storefront Renderer (SFR).** A dedicated Ruby service loads the theme and the data a request
  needs and returns HTML; it replaced the storefront code in the Rails monolith and cut average
  server response 4-6x (about 500 ms better TTFB for merchants). Three cache layers: a full-page
  cache that returns the whole HTTP response when it can, a query-result cache, and an in-process
  cache; a cache that is down counts as a miss.
  https://shopify.engineering/how-shopify-reduced-storefront-response-times-rewrite
- **Simplify, batch, cache.** The full-page cache keeps the final HTML string in node-local Redis
  by cache key; queries are batched in one round trip and "book-keeping" preloads what a page type
  used last time; a Liquid object memoiser saves 16-20 data reads per request on average. The
  article stresses making the code fast before caching it.
  https://shopify.engineering/simplify-batch-cache-optimized-server-side-storefront-rendering
- **Section Rendering API.** `?sections=a,b` (up to 5) returns JSON of section id to HTML on any
  page URL; `?section_id=x` returns one section's HTML. The section reads that URL's product or
  collection and its query (`q`, `page`). This is how themes update parts of a page without a
  framework. https://shopify.dev/docs/api/ajax/section-rendering
- **Cart AJAX API.** `GET /cart.js`, `POST /cart/add.js`, `/cart/change.js`, `/cart/update.js`;
  each can return re-rendered sections in the same answer (`sections`, `sections_url`), so a cart
  drawer updates with one request. https://shopify.dev/docs/api/ajax/reference/cart
- **Theme JS.** Dawn is "HTML-first, JavaScript-only-as-needed", server rendered with Liquid,
  progressive enhancement, client rendering used sparingly (https://github.com/Shopify/dawn).
  Shopify's performance guide: the Theme Store needs an average Lighthouse performance score of at
  least 60 across home, product and collection; avoid heavy frameworks; `defer` non-critical
  scripts; load modules with `import()` on interaction; never lazy-load the LCP image and give it
  `fetchpriority="high"`.
  https://shopify.dev/docs/storefronts/themes/best-practices/performance
- **Image CDN.** `image_url` takes `width`/`height` (up to 5760) and never upscales; the format
  (WebP/AVIF) is chosen from what the browser accepts; `image_tag` writes a `srcset` and lazy-loads
  sections further down the page unless `preload` is set.
  https://shopify.dev/docs/api/liquid/filters/image_url,
  https://shopify.dev/docs/api/liquid/filters/image_tag
- **Not verified:** how Shopify invalidates its full-page cache and exactly which cookies bypass
  it. No official Online Store page says so (only Hydrogen documents that a response setting the
  cart cookie is private). We do not rely on it.
- **Instatic** (radar entry, MIT, https://github.com/CoreBunch/Instatic): plain semantic HTML and
  CSS, no framework or hydration; static pages written at publish time and swapped atomically;
  often-changing routes served from a versioned in-memory cache that publish invalidates;
  per-visitor "dynamic holes" filled by a ~1.1 KB client runtime. That is the model we follow; we
  take the idea, not the code (pre-1.0, different stack).

What we already have that matches: a per-store render cache invalidated by Postgres NOTIFY
(`lib/store-cache.ts`, the equivalent of Shopify's full-page + query caches), edge caching with
purge on change (#1363), section rendering (`/theme-actions/section`), the cart endpoints the
theme calls (`lib/liquid-shim.ts`), and a media CDN with sized copies (#1340, #1361).

### What phase 1 removes

| Waimers home (estimate: the live HTML with the Next parts taken out, same theme files) | Before | After |
|---|---|---|
| Next/React JS | 15 files, 390 KB gzip | 0 (one inline island, 5.7 KB raw / 2.4 KB gzip) |
| Our global CSS | 2 files, 89 KB gzip | 0 |
| HTML | 794 KB raw / 110 KB gzip | about 700 KB raw / 100 KB gzip (no RSC data) |
| Theme JS and CSS | unchanged | unchanged |

Measured locally (Dawn imported into a copy of the Waimers catalogue, `next dev`, warm cache): home
39 script files → 9 (the theme's own), 30 stylesheets → 28 and 897 KB → 193 KB (dev builds are
unminified, so only the file counts and the CSS drop carry over), HTML 168 KB → 132 KB, server
time about 250 ms → 60 ms, no console errors, every parked theme script ran. `/pages/about`: HTML
85 KB → 58 KB, stylesheets 837 KB → 132 KB.

## Target architecture

```
browser ── Cloudflare (HTML cached for cookieless visitors, purged on change, #1363)
              │
           proxy.ts ── store switch on + / or /pages/<handle> + GET + no market folder ...
              │                                   │ otherwise
              ▼                                   ▼
   /-h/<store>/… Route Handler           /-s/<store>/… React page (unchanged)
   (lib/plain-html/render.ts)                     ▲
     theme layout + cached Liquid sections         │ page needs something only React draws:
     + our SEO head + one inline island script ────┘ handed back through this server (forward.ts)
```

**Route Handler inside Next vs a separate renderer.** Recommended: a Route Handler in the
existing storefront app (what phase 1 ships). It shares the process, the render cache, the proxy
(hosts, markets, redirects, password page, CSP nonce, edge-cache rules) and every data loader, so
the plain page and the React page can never drift apart, and there is nothing new to deploy. A
separate lightweight renderer (Bun/Hono with liquidjs) would start faster and use less memory,
but needs its own copy of host resolution, cache invalidation, markets, consent and SEO, its own
deploy and routing at the edge, and a way to keep two caches in step. Worth revisiting only if the
Next server itself becomes the bottleneck after phases 1-3 (it is not today: on a cache hit the
plain route answers in about 60 ms locally against about 250 ms for the React page).

**What becomes an island, and how it loads.** One inline script with the request's nonce, after
the page's markup (`lib/plain-html/islands.ts`, about 6 KB raw). No framework.

| Feature | Phase 1 | How it loads |
|---|---|---|
| Theme scripts (sliders, reveals, menus) | Yes | The theme's own files, run once the page is parsed (`__commerceBootTheme`); nothing hydrates first, so no waiting |
| Add to cart, `/cart.js`, cart page | Yes | The existing shim answers the theme's own calls (`/cart/add.js` → our cart, then the cart page) |
| Section rendering, recommendations, predictive search | Yes | The shim and existing routes, unchanged |
| Cookie consent | Yes, when the theme has its own cookie-banner section | The theme's banner answers through the shim; the island writes `wc_consent` and posts the proof to `/theme-actions/consent` |
| Visit beacon, GA4, Google Ads, Tag Manager, legacy Meta pixel | Yes | After the matching yes, when the browser is idle |
| Umami app | Yes | After a yes, or at once when the store does not wait for consent |
| Core Web Vitals (LCP, INP, CLS) | Yes | PerformanceObserver, sent to `/api/vitals` when the page is hidden |
| Inbox chat launcher, Chatwoot | Phase 2 (page stays React) | Small module loaded on idle or on first tap of a stub button |
| Pixels app events, discovery tracking, experiments beacon | Phase 2 (page stays React) | Same pattern, plain modules |
| Market suggestion banner, subfolder markets | Phase 2 (page stays React) | Server-rendered banner + a tiny module |
| Wishlist, variant/stock/price | Theme's own JS today | Theme JS + section rendering; our own live price/stock via `?section_id=` when needed |
| Our cookie banner (themes without one) | Phase 2 (page stays React) | Server-rendered markup + a small module |

**Checkout, account, cart page, thank-you, password page** stay React pages. They are personal,
never edge-cached, and their forms rely on server actions; nothing changes there.

**Product, collection, search, blog and article.** On import our React main section replaces the
theme's (`MainProduct`, `MainCollection`, `MainSearch`, `MainBlog`, `MainArticle`), so these pages
are not pure Liquid today and stay React in phase 1. Two ways forward, per page type:
1. Render the theme's own main section again (still in the bundle) and keep only what is ours as
   islands (pre-order note, notify-me, reviews widget, EMI, delivery estimate). Closest to Shopify.
2. Keep our main section but draw it on the server with `renderToStaticMarkup` (no hooks in the
   static part) and hydrate only the buy box as an island (a small Preact or vanilla module that
   posts to `/theme-actions/cart-add`).
Recommendation: (1) for collection, search, blog and article (their theme sections already read
our data through Liquid drops); (2) for the product page, where the buy box carries our checkout
rules.

**Our own (Puck) themes, later.** Publish renders each page's sections to static HTML with
`renderToStaticMarkup` into the same render cache, keyed by store version; client components
(add to cart, gallery, cart drawer) become islands with their own small bundles and a
`data-island` marker. The plain route then serves them exactly like a Liquid page.

**CSS per page.** The plain page links only the theme's own stylesheets (the layout's and each
section's `stylesheet_tag`). Our 552 KB global stylesheet is not sent at all. For Puck themes,
publish records which sections a page uses and links only their CSS (Tailwind per section group).

**Caching.** HTML is cached at the edge for cookieless visitors with purge on change (#1363), and
in the process cache per store version. Per-shopper parts are never in the cached HTML: the cart
count comes from `/cart.js` (shim), consent is read from the cookie in the browser by the island.
Phase 2 moves the theme banner's "ask or not" decision fully into the browser too, so a visitor
with only a consent cookie can be served from the edge.

**SEO.** The plain page is complete HTML with the same title, description, canonical, Open Graph,
Twitter, verification tags, robots rule and JSON-LD (Organization/WebSite on home) as the React
page. The sitemap, robots.txt and llms.txt are unchanged. No content depends on JS.

## Risks and what can break

- **Look changes where the theme silently leaned on our global CSS.** The React page also loads
  our 552 KB stylesheet, and some of its rules reach the theme (seen locally on Dawn: header icon
  pill, line heights). Zero Drift's heading reveal CSS lives in our `base.css`. Check Waimers home
  and pages side by side before switching on. If something the theme needs is in our CSS, move that
  rule into the import's theme CSS, not back into every page.
- **A feature only React draws** (chat, Pixels app, market banner, experiments, our cookie banner,
  app embeds): the route detects it and hands the page back to React; the reason is in the
  `x-plain-skip-reason` header. Nothing is silently dropped.
- **Hand-back cost:** an ineligible page is rendered by the React page behind one extra local hop.
  Only stores with the switch on pay it, and only on home and `/pages/*`.
- **Next upgrades:** the route uses only stable APIs (Route Handler, `headers()`, `cookies()`).
- **Not yet verified:** real-device numbers on Waimers (needs the switch on in production).

## Rollout and the way back

1. Merge with the switch off everywhere (default). Nothing changes for any store.
2. Test server: switch on for the test store, compare home and three pages visually against the
   React version, run Lighthouse twice.
3. Waimers: Online store › Preferences › Storefront speed › "Send pages as plain HTML". Check the
   response header `x-storefront-render: plain` (or `x-plain-skip-reason`).
4. Way back, fastest first: one browser `wc_plain=off` cookie (just you); the store's switch
   (within about 10 s, then the 30 s edge TTL or a purge); `STOREFRONT_PLAIN_HTML=off` for the
   whole deployment (restart).

## How we measure

- Before: the 9 Nov baseline (`scripts/run_all.sh`, 38 Lighthouse URLs, plus the per-page bytes
  above). After: the same script on the same URLs, run twice, with the switch on.
- Real visitors: the admin's Web performance strip (`/api/vitals`), compared for a week before and
  after per page type; the plain page reports LCP, INP and CLS through the island.
- Bytes per page from the HTML: Next JS, Next CSS and RSC data must be 0 on plain pages.

## Phases

| Phase | Scope | Rough effort |
|---|---|---|
| 1 (this PR) | Switch, proxy routing, plain route for home and `/pages/*` of imported themes, consent/analytics/vitals island, hand-back, skip reasons | Done |
| 2 | Islands for Inbox chat, Chatwoot, Pixels app, experiments beacon, market banner, our cookie banner; consent decision fully in the browser | 3-5 days |
| 3 | Collection, search, blog, article through the theme's own main sections + small islands | 1-1.5 weeks |
| 4 | Product page: static main section + buy-box island (pre-order, notify-me, reviews, EMI, delivery estimate) | 1.5-2 weeks |
| 5 | Our own Puck themes: static render on publish, per-section CSS, islands for client components | 2-3 weeks |
| 6 | Optional: move the plain route to a separate lightweight renderer if Next is the bottleneck | 1-2 weeks |
