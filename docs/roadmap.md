# Product roadmap

The order we work in. **Phase 1 comes first: test what we already have.** New features
(Phase 3) start only when the shops' everyday flows and the apps they use pass. Each item
becomes its own design and PRs when picked up. Last reorganised 7 Nov 2026; speed track added 10 Nov 2026.

## Phase 1: Test what exists (now)

Goal: every flow a shop owner or shopper touches has been run for real on a live store, and
every app is marked `tested: true` (manifest) or fixed. Untested apps show an "Untested" badge.

Each app is tested in two passes:
- **v1, functionality:** every feature works end to end on a live store. Passing v1 sets
  `tested: true`.
- **v2, UI:** the app's admin pages are redesigned to the Phase 3 standard ("Every app looks
  great") and checked again.

### 1a. Everyday shop flows (Waimers and Claw Gears)

Run each on the live store, note bugs as GitHub issues (`bug` label), fix, re-run.

- Shopper: browse, search, product page, cart, discount code, checkout (UPI, card, COD), order
  page, account sign-in, order emails and WhatsApp messages.
- Orders: list, filters, order page, edit, cancel, refund, collect payment, draft orders,
  returns and exchanges.
- Shipping: book one, book in bulk, labels, pickup, tracking updates, NDR, RTO.
- Invoices: GST invoice per order, bulk print, credit notes, GSTR-1 export.
- Products and stock: create, edit, variants, images, bulk edit, GST and HSN, stock moves.
- Customers, discounts (all types), gift cards, analytics numbers against real orders.
- Theme: editor, publish, both themes (Waimers revamp, Claw Gears imported Horizon).

### 1b. Apps, in the order the shops need them

Tested (v1) so far: **Delhivery, Razorpay, Cloudflare R2, Shopify importer** (R2 and the importer
marked 8 Nov 2026).

1. In use or needed for Claw Gears go-live: GST invoices, Shiprocket, RapidShyp, Reviews,
   WhatsApp, Amazon SES email, Inbox.
2. Selling and marketing: Back in stock, Forms, Affiliates, EMI & pay later, Search &
   discovery, Meilisearch, GrowthBook, Google Search Console, Umami, Chatwoot, Amazon S3.
3. Payments not in use yet: Cashfree, Decentro.
4. Couriers with no direct account (Bluedart, DTDC, Xpressbees and Amazon come through
   Shiprocket or RapidShyp): Blue Dart, DTDC, Xpressbees, Ekart, Shadowfax, India Post,
   FedEx, DHL Express, ShipGlobal. Test only when an account exists; until then they stay
   Untested.

### 1c. Outside reviews

- Shopify app: resubmit after the 3 Nov pause (`integrations/SUBMISSION.md` 3.7). IP allowlist
  before 12 Nov.
- Google: new demo video showing the consent screen (8 Nov).
- Meta: waiting on review (answer expected about 14 Nov).

## Phase 2: Finish what is half built

- **Bulk shipments redesign.** Per order: Air and Surface side by side with prices,
  insurance shown in the price (always on for Delhivery, a switch for Shiprocket and
  RapidShyp), a batch total, saved preferences by product type (glasspad → Delhivery insured,
  mice → Air, keyboards → Surface), and weight and box size fixable in the flow. Design in
  progress.
- **Store credit balance.** A real balance per customer: history and staff adjustments,
  paying with it at checkout and on admin orders, refunds to store credit, import from
  Shopify. Five steps.
- **Leaner image builds.** Build images on a small machine (target 1 GB RAM with swap) or a
  cheap remote builder instead of the 8 GB PC.

## Speed and memory track (runs alongside the phases)

Goal: the fastest, smoothest pages for shoppers and the least memory on the server, whatever the
language. Measured on 9–10 Nov 2026: median server response 1.2 s over 352 store pages; home
images 9 MB, product pages 8–11 MB; server 2.1 of 4 GB used (storefront 2 × 355 MB, admin 373 MB,
worker 229 MB). Each step is measured before and after; a step that does not beat the numbers
is dropped.

0. **Image processing must not starve the storefront** (#1471, urgent). On 10 Nov a photo upload
   made Waimers take 8 s per page: each image took 30–74 s on both cores, the worker has no CPU
   limit, and every finished image cleared the whole store's page cache. Fix: worker limited to
   1 core, one image thread, refresh only the pages that show the image, log slow renders. Must
   land before `media:reprocess` (step 2) runs.
1. **Cloudflare cache 10 minutes, cleared on every edit.** Code is done; needs the Cache Purge
   token, `STOREFRONT_EDGE_TTL=600`. Most visits answer in about 0.05 s.
2. **No multi-MB originals** (merged #1422). Deploy, then `media:reprocess --own-size` once.
3. **Server's own time.** Find and fix the slow queries behind the 1.2 s; target 0.2–0.4 s for an
   uncached page.
4. **Plain HTML for product and collection pages**, as done for home and `/pages/*`.
5. **One storefront copy** once the edge cache carries the traffic.
6. **Storefront server: measured choice.** One product page served by (A) Next today, (B) Bun +
   Hono with our Liquid engine, (C) Rust (liquid-rust plus the filters that page needs), and (D)
   A behind the edge cache. k6 at 20 and 100 users: p50/p99, memory, build time and memory, and
   an exact HTML match. The winner becomes the storefront; a rewrite is fine if it wins.
7. **Admin as a browser-only app** (no server, no Server Components): pilot on Orders first.
8. **Go or Rust for self-contained services**, starting with image processing; the backend API
   moves part by part (reads first, money rules last) only if the pilots win on the same
   measures.

### Long-term port: faster stack by April 2027

Agreed 10 Nov 2026. Two tracks side by side: the steps above keep improving today's stack (TypeScript,
Bun, Next, React), while the new stack is built and swapped in one piece at a time. Target: the
port released by **April 2027**. Every piece is switched only after it matches the old one
exactly on the same requests and beats it on speed and memory; until then the old one serves.

- **Target stack.** Backend API and worker: Rust (Axum, SQLx; Go if Rust slows the work too
  much). Storefront: plain HTML rendered by Rust (liquid-rust plus our Shopify filters), small
  JavaScript islands, Cloudflare edge cache. Admin: React today; SolidJS later only if a pilot wins.
  Postgres, Dragonfly and per-store row-level security stay.
- **How a piece moves.** Publish the oRPC contract as OpenAPI; generate the TypeScript client from
  it; the Rust server takes endpoints over at the same paths; each runs side by side with the old
  one (shadow traffic, compared answers) before it takes real traffic. Rust builds run on a cloud
  builder, not the dev PC.
- **Order and dates (targets, reviewed monthly):**
  - **Nov–Dec 2026:** finish the speed track above on today's stack; OpenAPI contract and client
    generation; Rust project skeleton and CI on a cloud builder; pilot: image processing worker
    in Rust; storefront server comparison (step 6).
  - **Jan 2027:** read-only API in Rust (products, collections, search, pages) behind the same
    paths; storefront product and collection pages rendered by Rust if step 6 wins.
  - **Feb 2027:** worker jobs in Rust (emails and notifications, courier tracking, sweeps); the
    rest of the storefront pages; cart in Rust.
  - **Mar 2027:** orders, checkout, payments (Razorpay first), refunds and couriers' booking,
    each shadowed against the TypeScript version with identical totals, GST and stock.
  - **Apr 2027:** remaining admin endpoints; full switch; old services kept one release as a
    fallback, then removed.
- **Done means:** shopper pages p50 under 0.3 s uncached and about 0.05 s cached, product pages
  under 1 MB, and the whole server under half its current memory.

## Phase 3: New features

- **Every app looks great.** Redesign each app's pages in the admin (connect page, settings,
  lists, empty states) to one polished, modern standard.
- **One site for every kind of seller.** Sell any mix of physical products, digital products
  (files, licence keys), subscriptions and courses from one store, with one checkout, one
  customer account and one admin. Today Koomerce is built around physical products.
