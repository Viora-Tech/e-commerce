# November small batch (branch `feat/nov-small-batch`)

Four small roadmap items, one commit each.

## 1. Ad clicks get the cached page

- Why it was slow: the Cloudflare cache rule "Store pages" keys by the full URL, and every ad
  click carries a unique `fbclid` / `gclid`, so each ad visitor was a cache miss and waited on the
  origin (up to 4.6 s on a cold product page). The origin already ignores these params
  (`edgeCacheControl` reads no query; `listingSearch` drops them from the Liquid cache key).
- Cache Rules can only drop query params from the key on Enterprise. A Transform Rule (Rewrite
  URL) runs before the cache on every plan and can `remove_query_args(...)`, so that is the fix.
- `apps/storefront/src/lib/tracking-params.ts` is the one list (click ids `fbclid`, `gclid`,
  `gbraid`, `wbraid`, `dclid`, `gad_source`, `gad_campaignid`, `ttclid`, `msclkid`, `twclid`,
  `li_fat_id`, `igshid`, and the `utm_*` tags), with `isTrackingParam`, `withoutTrackingParams`
  and `cloudflareTrackingRewrite()` that prints the rule's expression and query rewrite.
- Attribution is unchanged: the address bar keeps the params, and the beacon (`/api/beacon`) and
  pixels (`/api/px`) read `location.href`. `/api/`, `/_next/` and `/webhooks/` are never
  rewritten. `ref` (affiliate) is not in the list.
- Docs: developer docs "Storefront performance" → "Cloudflare in front", step 4, "Ad clicks".
- Tests: `apps/storefront/src/lib/tracking-params.test.ts` (11, run).
- **Owner:** add the Transform Rule on the SaaS zone (steps in the docs). Check with
  `curl -sI "https://www.waimers.in/?fbclid=test1"` twice with different values: the second says
  `cf-cache-status: HIT`.

## 2. Merchant picks the Recommended way to pay (already on dev)

Nothing to do in this batch: it shipped in 7c88fdcb2 (14 Nov, "Fixes #1173", issue closed).
Settings → Checkout → Recommended way to pay: Automatic (first offered, never COD), any enabled
way to pay, or None; the storefront shows no badge when the chosen one is not on offer or COD is
blocked for the order. English and Hindi copy are in `apps/admin/src/data/checkout-settings.ts`
and `data/hi/`. Re-ran `apps/storefront/src/lib/checkout-preview.test.ts` (25 pass).

## 3. Public product feed per store

- `/feeds/products.xml` (Google Merchant RSS 2.0, `g:` namespace) and `/feeds/products.csv`.
  One row per published variant: id (variant's numeric id, as `/products.json`), item group (the
  product), name ("Product - Variant" when there are several), price, compare price (only when
  higher; in XML `g:price` is the compare price and `g:sale_price` the selling price, as Google
  reads them), `in_stock` / `out_of_stock` (never a count), link (`?variant=` for several), image
  (the variant's, else the product's; made absolute), brand (vendor, else the store's name), SKU.
- Built from the Shopify JSON loaders (`feedProducts` → `loadProducts`: active products only, no
  drafts, archived or the payments test product; markets' catalogs apply), up to 5000 products /
  20 000 rows. Cached per store version and host (`storeRead`), `public, max-age=900,
  s-maxage=900, stale-while-revalidate=3600`, rate limited 20 a minute per IP, `noindex`. The
  proxy never mints the visitor cookie on these two paths (public cacheable files).
- Switch: Online store › Preferences › Product feeds (`preferences.feeds.products`, off by
  default; the storefront reads it through `storefrontLock`). While off the feed answers 404;
  behind the password page the proxy shows the password page, as for every page. The card lists both addresses once the switch is saved on.
- Files: `apps/storefront/src/lib/product-feed/{shape,respond}.ts`, routes under
  `app/-s/[storeId]/feeds/`, `data/product-feed.ts`; admin
  `components/preferences/product-feed-card.tsx`, `data/product-feed.ts` + `data/hi/`.
- Tests: `apps/storefront/src/lib/product-feed/shape.test.ts` (9, run). Admin i18n tests run.
- **Owner:** switch it on for Waimers in Preferences when wanted, then open
  `https://www.waimers.in/feeds/products.xml`. The Cloudflare cache rule "Store pages" already
  allows `/feeds/*`; an edit is purged by the worker like the pages.

## 4. Platform subdomain redirects to the custom primary

- `setPrimaryDomain` (`packages/core/src/domains/service.ts`): when a custom domain becomes
  primary, the store's platform domain (`<store>.koomerce.app`) gets `redirect_to_primary` on, so
  `resolve_host` reports it as redirecting and the storefront proxy answers 301 to the same path
  and query on the primary (`primaryRedirect`, unchanged). The merchant can still switch it off on
  the domain's page; making the platform domain primary again clears it (as before).
- Migration `0259_platform_domain_redirect.sql`: the same for stores whose custom primary was set
  before (Waimers: `waimers.koomerce.app` → `www.waimers.in` once deployed). Renumber at merge if
  another migration lands first.
- Never redirected, so the admin keeps working: frames (`sec-fetch-dest: iframe`, the theme
  editor canvas and admin thumbnails), `?theme-preview=` links, and now also a tab that carries
  the preview cookie (`wc_theme_preview`, host-only); `/api/`, `/_next/`, `/webhooks/` and the
  internal prefixes. The admin already builds every preview, canvas and "View store" link on
  `store.origin` (the primary), so none of them land on the subdomain in the first place.
- Previous behaviour, now changed: the old test said the platform domain "keeps serving until
  the merchant says otherwise"; `service.test.ts` now expects the redirect on, then off when
  switched off, then serving again when it is made primary.
- Merchant guide: Settings › Domains, "Your store address after a custom domain".
- Tests (run): storefront `src/lib/routing.test.ts` (new platform-subdomain block), core
  `src/domains/service.test.ts` (31), core `src/markets/service.test.ts`, db
  `test/resolve-store.test.ts`. `src/domains/routes.test.ts` does not load in this worktree
  (stale `@commerce/payments-snapmint` module).
- **Owner:** after deploy, `curl -sI "https://waimers.koomerce.app/collections/all?page=2"` should
  answer `301` with `location: https://www.waimers.in/collections/all?page=2`. Open the theme
  editor once to confirm the canvas still loads.
