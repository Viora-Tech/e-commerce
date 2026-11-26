# Affiliate portal: its own app at affiliate.<store domain>, out of the theme

Branch `feat/affiliate-portal` (from `origin/dev`). No migration. One approved `bun install`
(adds `@commerce/ui` to `apps/storefront`).

## What changed

- **The affiliate pages left the theme.** `/affiliate` (and everything under it) is now a separate
  small app in our shadcn look (`@commerce/ui`), laid out after shadcn's blocks: dashboard-01
  (inset sidebar, SiteHeader, SectionCards with trend badges, ChartAreaInteractive with a
  time-range toggle, DataTable with status tabs and pagination), sidebar-07 (collapses to icons,
  NavUser at the bottom, a sheet on a phone) and login-03 / login-02 for sign in and join.
  Owner feedback "looks like AI" was answered by following the blocks closely: no gradient
  blobs, icon tiles or oversized headings; titles sit in the SiteHeader.
- **Pages** (`apps/storefront/src/app/-f/[storeId]/`): Dashboard `(portal)/page.tsx`, Commissions,
  Payouts, Marketing tools, Settings (Profile, Payout and tax, Notifications, Security), Guide,
  plus `sign-in`, `signup` (the application with Benefits, the program's own questions and
  terms, or the application's status), `join` (Share and earn invite, `/affiliate/join?t=`),
  `export/commissions` and `export/payouts` (CSV), `continue` and `auth` (sign-in hand-off).
  Components: `src/components/affiliate-portal/*`; copy: `src/data/affiliate-portal.ts` (money
  words stay in `data/affiliate.ts`); server helpers `src/lib/affiliate-portal.ts`,
  `portal-data.ts`, `portal-actions.ts`, `portal-export.ts`, `portal-format.ts`.
- **Routing** (`src/lib/portal-routing.ts`, `src/proxy.ts`):
  - `affiliate.<domain>`: the store of the domain under it (`waimers.in`, or its www twin); every
    path is the portal's (`/` → `/-f/<store>`). A host that is itself another store's domain is
    never taken for a portal. Whole host isolated (`frame-ancestors 'none'`).
  - `/affiliate/...` on every store domain (and `<slug>.<platform>/affiliate`) serves the portal
    outside the theme, the password page and URL redirects. Once `affiliate.<domain>` is a live
    domain of the same store, page loads of `/affiliate/...` 302 to it (same path and query);
    `/affiliate/continue` and posts stay.
  - New internal segment `/-f`; header `x-portal-base` (`''` or `/affiliate`) tells pages where
    links start. `/affiliate` paths are now isolated like `/account`.
- **Sign-in on the portal host.** Sessions are host-only, so `affiliate.<domain>` keeps its own.
  An email code signs in there directly (the store's own actions). "Sign in with your store
  account" goes to `www.<domain>/affiliate/continue` (store sign-in first if needed), which signs
  a 2-minute single-use token (`lib/portal-handoff.ts`, new token purpose `affiliate-portal` in
  `core/shopper-login/tokens.ts`; the nonce is spent through the Redis rate limiter) and lands on
  `affiliate.<domain>/auth`, which starts the session. Covers Google, phone, passkey, etc.
- **Data** (`packages/plugin-affiliates/src/portal-activity.ts`, `portal-csv.ts`):
  `portalActivity` (referrals, sales, commission, clicks per India day/week/month between two
  days, from `affiliate_commission` and `affiliate_click_day`), `portalCommissions` (source,
  status, date filters, buyer masked), `updateAffiliateProfile` (name, profile link), CSV for
  commissions and payouts. `@commerce/ui/global/area-chart` is a shared area chart (the
  storefront has no `recharts` of its own).
- **CSS split.** The store's `globals.css` is no longer imported by the root layout: `-s`, `-p`,
  `-c` layouts import it, the portal imports `app/-f/portal.css`. Next loads a root
  `not-found.tsx`'s CSS on every page, so the bare 404 now uses a tiny `app/bare-404.css`
  (Tailwind theme + utilities for its own files, no preflight) and the checkout palette moved to
  `app/checkout-palette.css` (imported by both). Without this, the store's utility classes
  (`bg-muted`, `text-muted`...) overrode the portal's.
- Removed: `app/-s/[storeId]/affiliate/*` and `components/affiliate/*` (nothing else used them).
- `packages/ui` `Spinner` typed from its icon so apps with `exactOptionalPropertyTypes` compile.

## Not backed by data (shown read-only or skipped)

- Notifications: no per-affiliate switches are stored; the page lists the messages the store
  sends (approved/declined, new sale, payout).
- Security: sign-in methods and devices live on the store account (link to `/account/profile`).
- Guide: the store's program pitch (admin) plus our default steps and tips; no walkthrough video.
- Commission search by order number and "source" sub-tracking: we never show order numbers to
  affiliates; "Get link with source" adds `utm_source`, which commissions do not record.
- Hindi: the storefront has no Hindi wiring for affiliate copy; none added.

## For the owner: DNS / Cloudflare for affiliate.waimers.in

The platform registers the host through the existing domain flow, nothing new to provision:

1. Admin › Settings › Domains › Connect domain: `affiliate.waimers.in`, not primary, no redirect.
2. Add the two records it shows at the DNS host of waimers.in: `CNAME affiliate` → the same
   target `www` uses, and `TXT _waimers-verify.affiliate` → the token shown.
3. Press Verify connection. The worker creates the Cloudflare for SaaS custom hostname (HTTP DV
   certificate) and the Dokploy route, as for www. When it shows Active, `www.waimers.in/affiliate`
   starts sending affiliates to `affiliate.waimers.in`. Until then the path keeps working.

## Tests

- New: `apps/storefront/src/lib/portal-routing.test.ts`, `portal-proxy.test.ts` (proxy: portal
  host, isolation, internal paths, apex lookup, a store named `affiliate.*`, redirect once live),
  `portal-handoff.test.ts` (+ `referralLink`), `packages/plugin-affiliates/test/portal-activity.test.ts`
  (periods, per-day figures in India time, filters, other affiliate's rows, CSV, profile).
  `csp.test.ts` extended. All ran here and pass, with `routing.test.ts`, `csp-proxy.test.ts`,
  `order-token-proxy.test.ts`, `section-rendering-proxy.test.ts`, `plugin-affiliates portal.test.ts`.
- Typecheck: storefront, plugin-affiliates, ui clean.

## Left to do / to check on localhost

- The domain-connect step above was not run (no live calls). Check the admin accepts
  `affiliate.<domain>` as a non-primary custom domain end to end on the test server.
- Phone width (390px) was not checked in a real browser here (the shared Chrome window was not
  resized); the sidebar is the shadcn sheet below 48rem.
- Locally the store logo URL points at live storage, so the mark shows a broken image.
- Store pages now also load the small `bare-404.css` (root not-found); worth a glance at a
  React-theme page for any style change.
