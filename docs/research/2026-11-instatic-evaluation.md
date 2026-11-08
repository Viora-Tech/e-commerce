# Instatic as our page builder: hands-on evaluation (Nov 2026)

Status: research only. Written 9 Nov 2026. Nothing here changes the product.

**Recommendation: C. Keep Puck and copy Instatic's publishing approach.** We get almost all of
the speed this way. Instatic's editor cannot serve our stores today. It runs one site per server,
has its own login, refuses to be shown in an iframe, and its SEO output is thin. One person
writes 93 % of its code.

## What was tested

- Instatic **v0.0.21** (commit `2e6b4263`, 29 Oct 2026, MIT), cloned to
  `E:/Viora-Tech/eval/instatic` and run with `bun run dev` (SQLite, no Docker).
- The plugin code is in [`instatic-plugin/`](instatic-plugin/):
  - Two loop sources:
    - `koomerce.shop.products` is baked into the page when it is published.
    - `koomerce.shop.products-live` is request-dependent, so Instatic serves it as a "dynamic hole".
  - Two modules:
    - `koomerce.shop.add-to-cart` posts our existing `/cart/add.js` body: `{items:[{id,quantity}]}`.
    - `koomerce.shop.cart-count` reads `/cart.js`.
  - Each module adds about 1 KB of JavaScript.
- Data: 8 real Waimers products (titles, prices and CDN images taken from their product JSON-LD).
  We edited the stock and compare-at prices by hand so that every card state shows
  (`shop/fixtures/products.json`).
  - **Why we used a fixture and not a local Koomerce API:** Instatic's plugin sandbox blocks
    loopback and private IPs, and its manifest rejects `localhost`. A plugin can only reach a
    public hostname.
- The page: a Waimers-style landing page with a header and cart count, a hero, a static "Best
  sellers" grid (8 products), a "Live stock" grid (4 products, a dynamic hole) and an FAQ. We
  wrote it as clean HTML and turned it into an Instatic page tree with Instatic's own HTML import
  (`landing/build-page.ts`). We saved and published it through the editor's own API.
- A small Bun server (`scripts/koomerce-front.ts`) stood in for our storefront edge. It answers
  `/cart/add.js` and `/cart.js` and passes everything else to Instatic.
- An end-to-end check (`scripts/e2e-cart.ts`, Chrome) passed:
  - Add to cart worked in the static grid and in the hole grid.
  - The cart badge went 0 → 1 → 2.
  - The only console error was a 404 for `/favicon.ico`.

Screenshots: [published page, mobile](instatic-plugin/landing/screenshot-mobile.png),
[editor](instatic-plugin/landing/screenshot-editor.png).

## Measured numbers

All published-page numbers below were measured on `http://localhost:4100/`, the stand-in edge.

| Published page | Raw | gzip | br |
|---|---|---|---|
| HTML (whole page, 8 products baked in) | 9.0 KB | 2.5 KB | 2.1 KB |
| CSS, 3 hashed files (reset, framework, page) | 6.4 KB | 1.9 KB | 1.5 KB |
| JS: hole runtime + 2 module scripts | 2.5 KB | 1.3 KB | 1.1 KB |
| Hole fragment (4 live products, fetched after load) | 2.3 KB | 0.7 KB | 0.6 KB |

**Requests:** 17 in total.
- 1 HTML page
- 3 CSS files
- 3 JS files
- 8 product images (95.5 KB, from cdn.koomerce.app)
- 1 hole fragment
- 1 `/cart.js` call

Total transfer was 118 KB. The images are 81 % of it.

**Lighthouse 13.6, mobile:** two runs, same result both times.

| | Instatic page (local) | Live waimers.in home (9 Nov) | Live /policies/terms-of-service |
|---|---|---|---|
| Performance score | **100 / 100** | 45 | 94 |
| First paint (FCP) | 0.9 s | 2.5 s | 2.2 s |
| Largest paint (LCP) | 1.75 s (hero image) | 9.6 s | 2.2 s |
| Blocking time (TBT) | 0 ms | 868 ms | 35 ms |
| Layout shift (CLS) | 0 | 0.028 | 0.029 |
| Bytes | 118 KB | 12.1 MB | 1.0 MB |
| JS / CSS transferred | 3 KB / 7 KB | 572 KB / 393 KB | 558 KB / 281 KB |
| Requests | 17 | 127 | 72 |

Other Lighthouse scores for the Instatic page: Accessibility 95 (the grey strikethrough price
has low contrast, which is our CSS), Best practices 96 (no favicon), SEO 100.

Server side, on this Windows dev machine:
- A baked page answers in about 0.5 ms.
- A hole fragment takes about 5 ms when it is first rendered, then 0.2 ms from Instatic's
  in-memory cache.
- Publishing the site took under a second.
- The server process used about 92 MB of memory with one plugin worker.

**Be careful with this comparison.** It is not like for like:
- The live home has a 1.6 MB hero video, 41 full-size images, a mega menu, an imported Shopify
  theme and a real network with 1.5-4.8 s server time.
- The Instatic page was served from this machine, with Lighthouse's simulated mobile throttling.

What the numbers do prove is the **shape** of the output: one small HTML file, a few KB of CSS,
about 1 KB of JS per feature, and no framework. That is the same shape PR #1367 (plain HTML with
islands) is building for imported themes. The speed comes from that shape, not from Instatic in
particular.

## What worked well

- **The output is excellent.**
  - Semantic HTML, no editor attributes, no framework.
  - CSS is split into files named by their content hash and served with
    `Cache-Control: immutable`.
  - A strict CSP is built from what the page actually uses.
  - Pages with no JS get `script-src 'none'`.
- **Dynamic holes work as advertised.** A loop whose source is marked `requestDependent` turns
  into an `<instatic-hole>` placeholder. A 1.1 KB runtime fetches
  `/_instatic/hole/<id>?v=<site hash>` and swaps the fragment in. The hash checks that the
  fragment belongs to the same publish.
- **Module scripts are deduped** per module, loaded with `defer`, and same-origin only, so our
  `/cart/add.js` call worked under its CSP without any changes.
- **The plugin sandbox is serious.** It runs in QuickJS-WASM. Each permission is approved at
  install time, and outbound requests are checked against an allow list, a DNS check against
  private addresses, and every redirect.
- **The HTML import** (`<instatic-loop>`, `{currentEntry.field}` tokens) turned a hand-written
  page into editable nodes.

## Problems we hit (all on v0.0.21)

1. **Bug: a module used only inside a loop loses its CSS and JS on the published page.**
   - Site-wide module assets are collected by rendering pages without loop data
     (`server/publish/siteModuleAssets.ts`). The loop body is never walked.
   - Our add-to-cart button inside the product grid came out unstyled, with no script (a 404).
   - Workaround in the eval: one more add-to-cart button outside the loop, in the hero.
2. **The editor shows plugin loops as empty.**
   - The host replaces a plugin source's `preview()` with `[]` (`server/plugins/host/handlers/loops.ts`).
   - The canvas also leaves out plugin module CSS: the cart link and the add-to-cart button show
     as plain text.
   - A merchant would design the product grid blind. See the editor screenshot.
3. **The docs are wrong and errors are silent.**
   - Two mistakes in the docs:
     - The loop-source example uses id `acme.products` for plugin `acme.catalog`, but ids must
       start with the plugin id.
     - `defaultValue` in `filterSchema` is rejected.
   - Both calls fail without saying so unless you `await` them. The plugin still shows as
     "active", the loop renders empty, and the publisher strips the diagnostic HTML comment.
   - About 1.5 hours of the evaluation went on this.
4. **"Live" holes are cached for each publish.**
   - A `requestDependent` hole is rendered once per (node, query, publish version), then served
     from memory.
   - Stock shown this way is as old as the last publish or restart. Only `perVisitor` is really
     live, and it then runs the plugin sandbox on every page view without any cache.
5. **The plugin SDK is not published on npm.**
   - Plugins must be built inside an Instatic checkout.
   - On Windows the CLI needs a `zip` binary.
   - Importing the SDK root made our module bundle 428 KB, because nothing was tree-shaken.
6. **Small issues**
   - Alt text for images comes only from the media library, so external product images publish
     with `alt=""`.
   - Public 404s answer with JSON (`{"error":"Not found"}`).
   - Neither HTML nor hole fragments have `Cache-Control` or compression; the docs expect Caddy
     or a CDN to add them.
   - A malformed upload gives a 500.

## Integration with Koomerce

| Question | Finding | Impact |
|---|---|---|
| Embed the editor in our admin (iframe) | `/admin` always sends `X-Frame-Options: DENY` and `frame-ancestors 'none'` (`server/securityHeaders.ts`) | Not possible without a fork |
| One login / SSO | Instatic has its own users, sessions, roles (38 capabilities), TOTP and step-up password prompts. There is no SSO, OIDC, SAML or trusted-header login. Its OAuth is only for MCP clients | Merchants would have a second account, or we patch the auth |
| Multi-store / tenants | One site per server: site id `default`, one database, one uploads folder. The project's own rules say "self-hosted only … no assumptions about multi-tenant SaaS" | One Instatic process + database + disk per store (about 90 MB of memory each when idle), plus routing, upgrades and backups for each. Or a deep fork |
| Products / data | A plugin loop source calls a public Koomerce storefront API (needs `network.outbound` and an allowed host), or copies data into plugin storage on a schedule. It cannot reach our private Docker network | Workable, but every store needs an outbound-allowed host |
| Media | Its own media library, with storage adapters registered by plugins. It does not know our CDN sized copies, so there is no `srcset` from our media and no alt text | We would duplicate or bridge the media library |
| Publishing → our edge cache | Publishing bakes files to the Instatic server's disk. A plugin `publish.after` hook can call our purge (#1363) through a public URL | Workable. Cloudflare would cache an origin we do not run today |
| SEO | It writes `<title>`, meta description and `lang` only. No canonical URL, Open Graph, Twitter, JSON-LD, sitemap.xml or robots.txt (`/sitemap.xml` and `/robots.txt` return 404) | A step back from our storefront, which writes all of these |
| i18n / markets | One `settings.language` per site. No translated pages, no hreflang, no market subfolders | Does not fit our markets |
| Liquid themes | Not supported. Its "Super Import" turns static HTML into fixed pages, so a theme's sections, settings and Liquid logic are lost | Imported themes must stay on liquidjs (PR #1367 already covers them) |
| Cart / checkout | Works through our endpoints (proved here) | Fine |

## Project health

Source: the git log and `gh` on 9 Nov 2026.

- **Commits:**
  - Aug 54, Sep 50, Oct 49, Nov 1-9: 0. The last commit was 29 Oct, 11 days ago.
  - 1,250 commits in total since the first one on 30 Apr 2026.
- **Bus factor: 1.**
  - One developer wrote 1,165 of 1,250 commits (93.2 %). The next contributor has 13.
  - There are 38 authors overall, and 29 in the last 3 months, mostly with one or two commits each.
  - 52 % of commits are co-written with AI (Claude trailers).
- **Issues and PRs:**
  - Issues: 104 open, 56 closed.
  - PRs: 330 merged, 100 open, 41 closed without merging. Many outside PRs are waiting.
  - Issues closed in the last 3 months took about 15 days (median).
- **Releases:**
  - 21 tags, v0.0.1 to v0.0.21. That is about one a week in July and August, then 3 in
    September, 1 in October (12 Oct), and none since.
- **Breaking changes:**
  - None are labelled as such in CHANGELOG.md.
  - The README warns that APIs "can still shift before 1.0".
  - The repo's own agent rules say "No backward compatibility. Ever." for code and the plugin SDK.
    Only the database schema is promised to be stable.
  - We saw security fixes that tighten plugin capabilities.
  - **For a plugin we depend on, expect breaks on any release.**
- **Popularity:** 9.1k stars, 875 forks. The company behind it makes Motion.page and Core
  Framework, and it has GitHub Sponsors. In practice one person writes it.

## The three options

**A) Instatic replaces Puck for our own themes and landing pages.**
- It would need:
  - a fork that adds multi-tenancy (or one process per store);
  - SSO into our admin;
  - permission to iframe the editor;
  - SEO tags, markets and i18n;
  - fixes for the loop-asset bug and the empty canvas preview;
  - our media CDN as a storage adapter.
- After that, we would carry the fork against an upstream that promises no compatibility and
  has one maintainer.
- Rough effort: **10-14 weeks** to reach what Puck already does for us, then ongoing merge work.
  **Not recommended.**

**B) Instatic for content pages only (landing, blog, about); shop pages stay ours.**
- Smaller, but it still needs per-store Instatic instances, a second login, a second media
  library, our SEO head and our edge routing. It also splits merchants between two editors.
- Rough effort: **5-7 weeks** plus running N extra servers.
- Worth looking at again only if Instatic adds multi-site and SSO. Watch for that at 1.0.

**C) Keep Puck and copy Instatic's publishing approach. Recommended.**
- This is phase 5 of `docs/design/storefront-plain-html.md` (PR #1367), with three ideas taken
  from Instatic:
  1. **Bake on publish.**
     - Render each Puck page's sections to HTML with `renderToStaticMarkup` when the merchant
       publishes.
     - Store the HTML in our render cache under the store version.
     - Emit only the CSS for the sections the page uses, in content-hashed immutable files.
  2. **Find the holes automatically.**
     - A block that reads per-visitor or live data (cart count, live stock, recommendations,
       wishlist) is marked `dynamic` in its block config.
     - Publish emits a placeholder.
     - A runtime of about 1 KB (IntersectionObserver, with the publish version in the URL) fetches
       `/theme-actions/section?section_id=…`. That route already exists.
     - Live stock comes from our own cache, so it is never stale per publish.
  3. **One small script per island type.**
     - The script is deduped and loaded with `defer`, and finds its buttons by event delegation,
       like the add-to-cart module written here.
     - It is not a framework bundle. Our CSP nonce and the existing `/cart/add.js` shim stay.
- Rough effort: **3-4 weeks** (phase 5 alone was estimated at 2-3 weeks, plus about a week for the
  hole runtime, publish-version checks and tests).
- Merchants keep Puck, one login, multi-store, markets, our SEO head and our media CDN.

## Main risks of the recommendation (C)

- **Puck blocks that use hooks** have to be split into a static part and an island. Some blocks
  (galleries, carousels, cart drawer) need the most work.
- **Cache freshness:** baked pages must be rebuilt when a product price or stock changes, or the
  numbers must come from a hole. The rule: price and stock in product grids are holes, or they
  are rebuilt on catalogue change through our existing NOTIFY invalidation.
- **The CSS split per section** needs Tailwind output grouped by section. This is new build work.
- **We do not get Instatic's visual canvas** (several breakpoint frames side by side). If the
  owner wants that editor feel, it is a Puck UI project and does not need a platform change.

## If we ever revisit A or B

Check these first:
- multi-site or tenant support;
- an SSO / trusted-proxy login;
- an option to allow framing the admin;
- canonical, OG and JSON-LD output;
- the SDK published on npm;
- the loop-asset bug fixed.

The bug in item 1 of "Problems we hit" is worth reporting upstream either way. A minimal repro is
`instatic-plugin/landing/build-page.ts` without the hero button.
