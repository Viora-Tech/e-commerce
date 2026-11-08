# Product roadmap

The order we work in. **Phase 1 comes first: test what we already have.** New features
(Phase 3) start only when the shops' everyday flows and the apps they use pass. Each item
becomes its own design and PRs when picked up. Last reorganised 7 Nov 2026.

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

## Phase 3: New features

- **Every app looks great.** Redesign each app's pages in the admin (connect page, settings,
  lists, empty states) to one polished, modern standard.
- **One site for every kind of seller.** Sell any mix of physical products, digital products
  (files, licence keys), subscriptions and courses from one store, with one checkout, one
  customer account and one admin. Today Koomerce is built around physical products.
