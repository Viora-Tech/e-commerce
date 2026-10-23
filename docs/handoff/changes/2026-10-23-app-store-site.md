# App Store moves to its own website

Branch `feat/app-store-site`. Owner decision: apps are browsed and installed from a website, like
apps.shopify.com; the admin keeps only Installed apps, the app pages and the install route.
Third-party apps (OAuth install, public API, webhooks) are a later phase
(`docs/superpowers/specs/2026-10-21-app-platform-roadmap.md`); URLs and data are shaped for them.

## Where it lives

- **One source of truth.** Each plugin manifest has an optional `listing` (`AppListing` in
  `packages/plugins/src/types.ts`: tagline, highlights, guide, worksWith, screenshots, keywords,
  unlisted). `bun scripts/gen-app-catalogue.ts` copies the listed apps from `commerce.config.ts`
  into `packages/core/src/apps/catalogue.generated.ts`; `@commerce/core/app-catalogue` adds prices
  from `APP_PRICING` and the search, filter, category and related helpers. The `app-catalogue`
  sweep fails when the generated file is stale or a logo is missing. The old hand-kept app list in
  `apps/www/src/data/apps.ts` is gone (only copy is left there).
- **Logos**: `APP_LOGOS` in `@commerce/core/app-logos`, files in `public/app-logos` of both the
  admin and www.
- **Website** (`apps/www`, static export): `/apps` (categories, search, Free/Paid and "Built by
  Koomerce" filters kept in `?q=&price=&ours=1`), `/apps/category/<slug>` (one static page per
  category), `/apps/<id>` (what it does, works with, admin pages and theme blocks it adds,
  permissions with why, what it shares, price, details, related apps). Metadata, canonical,
  sitemap entries, `WebApplication`/`ItemList`/breadcrumb JSON-LD, OG images.
- **Install** goes to `siteConfig.urls.admin` + `/apps/install?app=<id>` (`NEXT_PUBLIC_ADMIN_URL`
  overrides it for a local build). Logged out: the admin layout returns to the link after sign-in.
  Several stores: the install page asks which store (`&store=<id>` once picked; the layout's own
  store picker also lands back on the install link). Then Connect → Permissions → Done as before.
- **Admin**: `/apps/store` permanently redirects to the website. The in-admin store (apps-list,
  hero, recommended strip, store cards) is deleted; `AppSummary` moved to `lib/app-summary.ts`.
  Every "App Store / Browse apps" link opens the website in a new tab through
  `components/apps/app-store-link.tsx` (`appStoreUrl()` in `@commerce/config/site`): Installed
  apps header and empty states, product More tab, Shipments and Create shipment (shipping
  category), Settings → Shipping, provider settings empty state, Home "Set up shipping" card, theme
  editor Apps tab, an "App Store" row at the bottom of Apps in the sidebar, the command palette and
  settings search ("Find more apps", "Connect a courier"). English and Hindi copy.

## Routing decision

The site is a static export on Cloudflare Workers static assets (`apps/www/wrangler.jsonc`). A
Next `proxy.ts` never runs in a static export, and a Worker cannot rewrite `apps.koomerce.app/*`
onto `/apps/*` without breaking Next's client navigation (its RSC payload paths follow the
pathname). So **`koomerce.app/apps` is canonical** and `apps.koomerce.app/*` is a 301 to it, the
same way `www.koomerce.app` is handled today. `siteConfig.urls.apps` is the one place to change
if that flips later.

## Owner to do (not done by this PR: no DNS or deploy changes)

1. Cloudflare DNS, zone `koomerce.app`: add `apps` as a **proxied** record (for example
   `AAAA apps 100::`, orange cloud on) so the redirect rule can run.
2. Cloudflare → Rules → Redirect Rules, new rule "apps subdomain": when hostname equals
   `apps.koomerce.app`, dynamic redirect to
   `concat("https://koomerce.app/apps", http.request.uri.path)`, status **301**, preserve query
   string. (`apps.koomerce.app/reviews` → `koomerce.app/apps/reviews`.)
3. Deploy www as usual (`bun run build`, `bunx wrangler deploy` from `apps/www`) and the admin
   through the normal pipeline.

## Left for later

- Screenshots: the listing supports them, but none are shot yet, so app pages show no gallery.
- Third-party listings, developer submission and review.
