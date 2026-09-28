# Handoff: state of play

Written 22 September 2026, after PR #59. Read this first when starting a session with no
conversation history. Everything here is checked into the repo, so it survives model or
machine changes.

## Latest state (27 September 2026)

The sections further down describe an earlier stage and are partly outdated; this list wins.

- **Build your own sections** (27 September 2026, `feat/custom-sections`, stacks on
  `feat/editor-modern-look`, no migration): Puck slots. Layout blocks `Group`, `Columns`,
  `Grid`, `Tabs`, `Accordion`, `Carousel` hold any block, nestable; elements `Heading`, `Text`,
  `Image`, `Button`, `Icon`, `VideoPlayer`, `Spacer`, `Divider`, `Badge`, `ProductCard`,
  `CustomHtml`; every one has a `style` panel (spacing, size, text, colour tokens or custom,
  corners, shadow, visibility per breakpoint). Storefront draws slots on the server
  (`renderBlock` in `@commerce/blocks/slots`). Custom HTML goes through `sanitize-html` (MIT)
  with a strict allow-list, iframes only from YouTube/Vimeo/Instagram and sandboxed, on draft
  save, on render and in the editor. Tree shows nesting (indent guides, collapse), reorder per
  slot, "Move out of", "Save as my section"; Add panel has a **My sections** tab (store-level,
  `store.preferences.customSections`, 40 sections / 1 MB, copies get new ids). Hotkeys:
  Cmd/Ctrl+C/V/D, Alt+Up/Down, Delete, for nested blocks too. Docs: developer docs "Slots and
  custom sections", merchant guide "Build your own section". DB-backed tests for the service
  and the preferences merge were not written or run in the cloud session (no Postgres there).
- **Theme editor modern look** (27 September 2026, `feat/editor-modern-look`, no migration):
  restyle of the Customize chrome only (layout and behaviour unchanged). One icon family
  (Phosphor regular, `editorGlyphs` in `packages/ui/src/icons.tsx`, 16px sidebar / 14px
  inline), section glyphs on small tiles tinted per kind (layout, text, media, product, app;
  `lib/customize-section-kinds.ts`), 13/12/11px type scale with sentence-case group headings,
  32px rows, 8px row / 12px panel radii, `bg-muted/60` hover, selected = accent wash plus a
  2px accent bar, visible focus rings, motion capped at 200 ms. Scale lives in
  `lib/customize-chrome.ts`. Font stays Satoshi; Inter or Geist for the chrome is offered as a
  follow-up for the owner to decide.
- **Theme editor, part 2** (27 September 2026, `feat/editor-part2-finish`, no migration):
  Shopify-style Sections sidebar (collapsible Header / Template / Footer groups; rows with drag
  handle, blocks toggle, eye and a ⋯ menu for Duplicate / Rename (`props._name`) / Remove; an
  insert line with "+" between any two rows, and on the canvas between sections, both inserting
  at that exact index via `insertActions` in `apps/admin/src/lib/customize-insert.ts`; blocks,
  meaning a section's array-field items, nested under it with "Add block"). Link picker: one
  search across products, collections, pages, blog posts and policies, drill-down, recent
  picks, validated "Paste a link", an "Open in a new tab" switch (`newTab` on link objects),
  shown as a chip. Image picker: drop-to-upload, alt text, focal point (`focal: { x, y }` in %,
  applied by blocks as `object-position` via `focalStyle`), Replace / Remove, and the media
  dialog's "Recently used" strip, arrow-key grid and `<Picture>`/ThumbHash thumbnails
  (`listMedia` now returns `variants` and `thumbhash`). Editor motion tightened to 150 to 220 ms
  with no overshoot. Also carries part 2's WIP (ten new sections, grouped section settings,
  scroll-to-new). Data shapes and internals: developer docs, Building, "Theme editor". Next on
  this editor: dynamic sources (`{ "$source": "…" }`) on the same link and image fields;
  migration 0074 is reserved for that follow-up.
- **Dynamic sources in the theme editor** (27 September 2026, `feat/dynamic-sources`): Shopify's
  "Connect dynamic source". A database button beside text, rich text, image, link, number and
  colour settings opens a picker of type-compatible sources (product fields and metafields on
  product templates, collection fields and metafields on collection templates, store details
  and metaobject entry fields everywhere); a connected setting shows a chip with ✕. Bindings
  are `{ "$source": "product.metafields.custom.material", "kind": "text", "fallback": ... }`
  inside section props (no migration). Pure rules in `@commerce/core/dynamic-sources`
  (`packages/core/src/dynamic-sources/`), loader under RLS in its `service.ts`; the storefront
  resolves in `renderTemplate` (`sources: { productId | collectionId }`), empty sources render
  the typed-in fallback. Save refuses bindings to sources that no longer exist. The vendored
  product taxonomy JSON moved to `packages/core/src/catalog/` (admin imports
  `@commerce/core/product-taxonomy.json`) so `product.category` can be named server side.
  Developer docs: `developer-docs/building/dynamic-sources`; merchant guide: Online store.
- **Images built off the server** (27 September 2026, `claude/release-images-ghcr`): new
  `.github/workflows/release.yml` builds admin, storefront, worker, tasks (migrate/backup) and docs
  images on every push to `main`, pushes `ghcr.io/viora-tech/<app>:<sha>` and `:latest` (GHA
  layer cache), then POSTs `DOKPLOY_WEBHOOK_URL` if that secret is set. `deploy/docker-compose.prod.yml`
  uses `image: ...:${IMAGE_TAG:-latest}` + `pull_policy: always` (no `build:`); rollback = set
  `IMAGE_TAG` to an older sha in Dokploy and redeploy. Dokploy auto-deploy must be **off** (the
  workflow's webhook deploys once images exist); the server needs a `read:packages` token for
  GHCR. Admin build takes repo variable `NEXT_PUBLIC_WORKER_URL`. `@aws-sdk/client-s3` moved from
  root devDependencies to root dependencies (backup/restore scripts). No migration.
  **Open issue found, not fixed**: the compose `internal` network is `internal: true` (no
  internet egress) and `worker`/`backup`/`migrate` sit only on it, so the worker can't call
  payment/shipping APIs and backups can't reach R2 — fix before the first deploy.
- **Worker dev restarts** (27 September 2026, `claude/worker-dev-watch`): `apps/worker` `dev` now
  runs `scripts/dev.ts`, a small supervisor that watches the worker's transitive workspace
  packages (`src/` + `package.json` of each) and restarts it on change. It replaces
  `bun --watch`, which on Windows ignored `packages/*`. See developer docs, Running locally,
  "Worker restarts in dev". No migration.
- **Custom WebGL globe** (27 September 2026, `feat/webgl-globe`): Analytics → Live view now
  draws our own WebGL globe (`apps/admin/src/components/analytics/live-globe/webgl-globe-canvas.tsx`
  + `webgl/`, no three.js, ~6 KB minified engine) instead of cobe. Land dots are placed on the
  CPU in full precision from `apps/admin/public/globe/land-2048.png` (same Natural Earth map as
  the cobe patch) with four levels of detail (40k to 1.08M sphere points; India ~390 dots with
  cobe, ~13k at the top level); zoom goes to 4×. Lazy-loaded with `import()` after the stats
  paint. Home card keeps cobe. Both share `globe-controls.ts`, `globe-overlay.tsx`,
  `globe-palette.ts`, `types.ts`. Developer docs: `developer-docs/building/live-globe`. Known,
  untouched: the cobe card's marker buttons use `projection.ts`, which is 90° off cobe's own
  projection, so its hover targets drift from the drawn markers.
- **EMI & pay later app** (27 September 2026, `feat/emi-widget-app`): built-in app
  `emi-pay-later` (`packages/plugin-emi`) puts "or ₹X/month with EMI or pay later" under the
  product price and adds an **EMI offers** app block. Settings (on/off, Razorpay or Cashfree,
  lowest price) live in `store.apps.settings['emi-pay-later']` via new
  `appSettingsOf`/`withAppSettings` in `@commerce/core` (no migration). Shows only when the
  gateway is enabled and EMI is on at checkout. With Razorpay it loads Razorpay's official
  Affordability Widget script (public key id only), falling back to the `@commerce/core/emi`
  line when the script fails, in dark theme, or when another block holds the widget. Stores
  without the app keep the old `EmiHint`. Admin: Apps → EMI & pay later.
- **Product page UX** (27 September 2026, `claude/exciting-einstein-nos00p`): option chips build every
  variant combination (ids carried over on add/remove, stock-loss confirm, bulk price/stock/SKU
  prefix, SKU suggestions); category picker over Shopify's MIT Standard Product Taxonomy
  (`product.category_id`, trimmed data from `scripts/trim-product-taxonomy.ts`, lazy-loaded);
  collections card; per-product package box (`variant.box_preset_id`, `package_*_cm`) with a
  volumetric hint, used by shipment booking when every line agrees; sticky side column, jump nav,
  rare cards under "More settings"; "Google search preview". Migration `0072` (0071 is PR #182).
- **Guided onboarding** (27 September 2026, `feat/onboarding-guided-flow`): `/onboarding` is now one
  question per screen with progress dots and Back: store name + address → what you sell (picture
  cards → starter automatic collections keyed by tag) → where you are based (India default, state
  for GST, written to `store.address`) → do you already sell somewhere (Shopify installs the
  importer and lands on `/apps/shopify-import`). Answers on `store.business_profile`. Invite mode
  shows a waitlist form (email, phone, what you sell; 5/hour per user and IP) into
  `signup_waitlist`; `platform:invite` marks the row invited. Migration `0073_signup_waitlist`.
  `bun run test:sweeps` is green again (onboarding + media headers, orphan fixes/allow-list).
  **Main's migration chain needs a fix**: the #183 merge dropped `0071_media_pipeline` from
  `_journal.json`, and the 0071 and 0072 snapshots both point at 0070, so `drizzle-kit generate`
  errors with a snapshot collision on main (details in the PR).
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
- **Done since the old queue** (all merged by 27 September 2026): auto-confirm UPI via Razorpay
  QR + manual-UPI expiry, light/dark presets in Settings → Appearance, order status split,
  React Email templates, GlitchTip error tracking, Returns & RTO, order emails (out for delivery,
  delivered, NDR, cancelled, refund), sender email from the merchant's own domain, S3 storage,
  RapidShyp (full API), Growth (sales by source), Shopify import via Dev Dashboard apps, merchant
  onboarding, and the Dokploy deployment files (#173).
- **Open PRs waiting for a local test run** (need Postgres, so run them on the owner's machine):
  #180 Shopify import speed-up (bulk operations + parallel writes), #181 price fields / sale-date
  labels / import history fixes, #182 image pipeline (sharp, AVIF/WebP variants, GPS stripped,
  ThumbHash; migration `0071_media_pipeline`).
- **In progress**: product page overhaul on branch `feat/product-page-ux` (WIP commit): options
  auto-generate variants, Shopify product-taxonomy category picker, collections on the product
  page, package/box size with volumetric weight, sticky side column + section nav, "Google
  search preview". Next migration number is **0072**.
- **Queued, in order**:
  1. Waimers Shopify import rehearsal on a clean local store (dry run → real import → check
     products, images, collections, customers, order numbers, menus, redirects).
  2. After #180 and #182: process Shopify-import media automatically (today it needs
     `bun run media:reprocess`).
  3. Deployment follow-ups: image builds moved to GitHub Actions → GHCR (see top of this list);
     next fix the `internal` network egress, re-measure image sizes, then first deploy. The owner's new AWS account needs the Paid plan /
     a limit raise before Lightsail allows the 8 GB plan.
  4. Pre-go-live: ~~EMI/pay-later widget app~~ (PR open), Razorpay OAuth connect (needs Technology Partner),
     Cashfree, CMS upgrade. Decentro waits on their reply (v2 vs v3, consumer_urn).
  5. Small: worker `bun --watch` should also watch `packages/*`; a platform page to browse the
     signup waitlist and invite from it.
  5. Small: fuller onboarding (what you sell, location step, waitlist). (Worker watching
     `packages/*` is done, see above.)
  6. Later: Home dashboard redesign (waiting for design references), custom WebGL globe (cobe
     tops out at ~32k dots), section library → Shopify theme importer (Level 1: rebuild with our
     blocks; Level 2: LiquidJS for owner-owned themes only) → website builder / editor part 2
     (`feat/editor-part2`, paused) last.
  5. Small: worker `bun --watch` should also watch `packages/*`; fuller onboarding (what you sell,
     location step, waitlist).
  6. Later: Home dashboard redesign (waiting for design references), section library →
     Shopify theme importer (Level 1: rebuild with our blocks; Level 2: LiquidJS for
     owner-owned themes only) → website builder / editor part 2 (`feat/editor-part2`, paused)
     last.

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
