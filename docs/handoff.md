# Handoff: state of play

Written 22 September 2026, after PR #59. Read this first when starting a session with no
conversation history. Everything here is checked into the repo, so it survives model or
machine changes.

## Latest state (24 September 2026)

The sections further down describe an earlier stage and are partly outdated; this list wins.

- **Product page UX** (27 September 2026, `claude/exciting-einstein-nos00p`): option chips build every
  variant combination (ids carried over on add/remove, stock-loss confirm, bulk price/stock/SKU
  prefix, SKU suggestions); category picker over Shopify's MIT Standard Product Taxonomy
  (`product.category_id`, trimmed data from `scripts/trim-product-taxonomy.ts`, lazy-loaded);
  collections card; per-product package box (`variant.box_preset_id`, `package_*_cm`) with a
  volumetric hint, used by shipment booking when every line agrees; sticky side column, jump nav,
  rare cards under "More settings"; "Google search preview". Migration `0072` (0071 is PR #182).
- **Merchant onboarding** (26 September 2026, `feat/onboarding`): `/onboarding` lets a signed-in
  person with no store yet create one - store name and address (live availability, reserved
  words) - via `createStore` (`packages/core/src/onboarding/service.ts`; transactional-per-step,
  idempotent against double-submit). Gated by `MERCHANT_SIGNUP_MODE` (`invite` default, `open`):
  in invite mode, no live invite means "Signups are invite-only for now" instead of the wizard.
  No platform admin UI yet - `bun run platform:invite <email>` prints the link. Existing staff
  invitations to an existing store are untouched. Store picker (`/select-store`) gained a
  "Create another store" link. Migration `0070_signup_onboarding` adds `signup_invite`
  (single-use, email-keyed) and a `store_slug_taken` SECURITY DEFINER function so the slug check
  works before any store's RLS context exists.
- **Built since**: GST invoices app (queue, series, credit notes, GSTR-1), shopper accounts,
  search and collection filters, gift cards, metaobjects, custom domains, Shopify importer and
  URL redirects, marketing (attribution, campaigns, automations), analytics reports catalogue,
  shipping zones and rates, payment attempts with idempotent webhooks, unpaid-order expiry,
  transactional outbox, rate limits, pre-order with deposits and balance collection, launch
  countdown, back-in-stock alerts app, admin accent colour, and the admin premium UI pass
  (see `docs/design/admin-frames.md`, "Premium pass").
- **Marketing renamed to Growth** (26 September 2026): admin section moved to `/growth`
  (`/growth`, `/growth/campaigns`, `/growth/automations`, new `/growth/links` UTM builder), old
  `/marketing/*` paths redirect permanently. Overview now leads with sales by source (Instagram,
  Facebook, YouTube, Google, WhatsApp, AI assistants, Email, Direct, Other) with a best-source
  callout and a By source / By channel toggle; core marketing domain names (`@commerce/core/marketing`,
  permissions, table names) are unchanged.
- **Working rules**: one build at a time and merge before the next; check open source first
  (`docs/open-source-radar.md`) and credit per `THIRD_PARTY_NOTICES.md`; UI tweaks are
  reviewed live on :3200 before a PR.
- **Queued**: auto-confirm UPI (Razorpay QR) and manual-UPI expiry, light/dark theme presets in
  Settings → Appearance, order status split, React Email templates, GlitchTip error tracking,
  Home dashboard redesign (waiting for design references), deployment (Coolify or Dokploy on
  Lightsail), then the SaaS layer.

## What this is

Waimers Commerce Platform: an Indian D2C commerce platform (Shopify-shaped, multi-tenant)
in `E:\Dev\my e-commerce`, GitHub `Viora-Tech/e-commerce`. First tenant is Waimers, a
gaming-peripherals store currently on Shopify. Later it is sold to other merchants.

Turborepo + bun. Apps: `apps/admin` (Next, port 3200), `apps/storefront` (Next, 3100),
`apps/worker` (Bun + BullMQ, 4100). Packages: `core`, `db`, `api` (oRPC), `ui`, `blocks`
(Puck), `editor` + `richtext` (Lexical), `payments*`, `shipping*`, `notifications*`,
`storage*`, `plugins`, `queue`, `config`.

## Running it

```bash
docker compose up -d --wait     # Postgres 17 + Dragonfly
bun install
bun run db:migrate              # dev database
bun run db:seed                 # real Waimers catalogue (72 products)
bun run db:seed:demo            # 60+ orders, customers, drafts, abandoned carts
bun run db:seed:demo:collections
bun run dev                     # all three apps
```

Admin http://localhost:3200, storefront http://localhost:3100, worker http://localhost:4100.
Keep those three running while working; they are how the UI gets reviewed. Background agents
must use other ports (3700+) and stop them afterwards.

Secrets live in the root `.env` (gitignored); every app reads it via
`bun run --env-file=../../.env`. `.env.example` lists the keys.

## Conventions that are enforced

- **Component structure** (`docs/conventions.md`): one component per file, `export default`,
  props `type` (never `interface`), pure helpers at module scope, body order hooks →
  helpers/handlers (arrows) → early returns → render logic → single return. No
  `useCallback`/`useMemo`/`memo` (React Compiler). `bun run lint` runs
  `scripts/check-components.ts`, which fails the build on violations.
- **Copy** lives in `data/<feature>.ts`, never inline in components. No em or en dashes in
  user-facing strings.
- **Sizes in rem**, Tailwind only. No handwritten CSS beyond `@theme` tokens, print styles and
  third-party overrides. Density target is Shopify admin on the Figma layout.
- **Client components must not import server values from `@commerce/core`** — use the pure
  subpaths (`@commerce/core/catalog`, `/permissions`, `/segments`, `/adjustments`, …). This has
  broken the build four times.
- **Git**: one branch and one PR per change, based on `main`, descriptive branch name. Kuldeep
  reviews and merges. Commit trailers are configured per session.

## Design source

The admin is reproduced from a Figma kit (file key `m7I3nV2svzBSrW8PcnybiH`, "Dealport"
e-commerce dashboard), not invented. Tokens in `docs/design/admin-tokens.md`, the component
sheet mapping in `docs/design/admin-kit-components.md`, per-page frames and every deviation in
`docs/design/admin-frames.md`. Font Satoshi, icons Hugeicons (`packages/ui/src/icons.tsx`),
primary Ocean Green `#4EA674`.

Frames used so far: dashboard `5:1346`, order list `5:2353`, customers `5:2879`, collections
`5:3936`, add product `5:4954`, profile form `5:5480`, component sheet `14:99`, colours `8:33`,
typography `5:5870`, space and effects `5:6061`, icons `11:127`.

Rule learned the hard way: build every element the frame shows. If the data does not exist,
build the data path or put a data equivalent in the same slot, and log it as a deviation.

## What is built

**Platform.** Multi-tenant on Postgres RLS (`store_id` everywhere, `apply_store_rls()`,
`withStore()`); Better Auth email OTP + organizations; oRPC API with `storeProcedure`;
workflow runner with compensation (`placeOrder`); plugin system (`commerce.config.ts`,
`@commerce/plugins`, Apps page, `apps/docs/content/developer-docs/building/plugins.mdx`).

**Payments**: Razorpay, COD, UPI/bank transfer with per-order QR, Snapmint via Razorpay,
per-method fees and discounts. **Shipping**: Delhivery (serviceability, delivery estimate,
waybills, tracking) ported from Kuldeep's own Shopify app. **Notifications**: SES and WhatsApp
channels, order placed/paid/shipped, abandoned-cart recovery. **Storage**: R2 (live bucket
`waimers`) plus a local dev provider; product media upload, library, video support.

**Admin pages.** Dashboard (kit components, live visitors, report tabs), Orders list + detail
(fulfilment, GST split, collect payment, refunds, grouped timeline, prev/next), Drafts,
Abandoned checkouts, Products list (filters, bulk, CSV import/export) + form (frame layout,
variants matrix, media, SEO), Collections (manual and automatic rules) with storefront pages,
Customers list (frame) + detail + segments, Analytics (overview, four reports with CSV, live),
Apps, Settings (general, payments, shipping, notifications, files, staff), Pages with the Puck
builder. Roles and permissions: 31 typed permissions, `role`/`role_permission`/`store_member`,
`can()` on all 92 procedures, Staff settings page.

**Store migration.** Shopify importer app (`packages/plugin-shopify-import`, Apps → Shopify
importer): Shopify product, customer and order CSVs, or a custom-app Admin API token for
products, collections, customers, orders, pages, blog posts, menus and URL redirects. Runs are
BullMQ app jobs with a dry-run preview, per-row issues and an id mapping table, so re-running
updates instead of duplicating. Images are re-hosted in the store's storage provider. Imported
orders carry `order.imported_from` and are read-only (no stock, messages, invoices or hooks).
URL redirects (Content → Menus → URL redirects) are served by the storefront proxy.

**Storefront.** Host-based routing via `proxy.ts`, Glide-derived theme, home and pages from
Puck, product page with delivery estimate and EMI hint, cart, checkout (payment methods,
discount codes, pincode serviceability), thank-you with manual payment instructions,
collection pages, cart recovery links.

Migrations are at `0035`. Tests: 17 vitest projects, all green; `bun run test` from the root.

## Open loose ends

1. ~~Order status duplicates payment and shipment state.~~ Done (`feat/order-status-split`,
   migration 0062): `order.status` is lifecycle only (`draft | open | completed | cancelled`);
   `payment_status` and `fulfillment_status` are derived from payments, refunds, line
   quantities and shipments by `recomputeOrderStatuses` (`packages/core/src/order/recompute.ts`),
   which every mutation path calls in its transaction and which writes `order.paid` /
   `order.fulfilled` on real transitions only. Rules: `@commerce/core/order-status`.
   "Checkout paid" (the old `placed` vs `paid`) is `order.checkout_paid_at`.
2. Parallel worktrees share the dev and test databases, so migration numbers collide and the
   `__drizzle_migrations` log drifts. Per-worktree database names would fix it.
3. Sections still on empty states: Content (files beyond the media library, metaobjects),
   Marketing, Online Store (themes, navigation, blog, preferences), Settings (domains,
   invoices), Products sub-pages (inventory, transfers, gift cards).

## Next in the pipeline

Navigation editor, theme editor (store colours and fonts to storefront CSS vars), remaining
Glide sections as Puck blocks, storefront search, shopper accounts, SEO and JSON-LD, Motion
animations; then backend scale work (domain events with a transactional outbox, observability,
idempotency keys, read caching, rate limits); then GST invoices, returns and RTO, abandoned
cart automation, Snapmint direct adapter; then deployment (AWS ECS pipeline, Cloudflare,
Lambda@Edge routing) and the SaaS layer (onboarding, tenant billing, plugin marketplace).

See `apps/docs/content/developer-docs/building/architecture.mdx` for the target architecture and the ordered scale roadmap.
