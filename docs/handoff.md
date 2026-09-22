# Handoff: state of play

Written 22 September 2026, after PR #59. Read this first when starting a session with no
conversation history. Everything here is checked into the repo, so it survives model or
machine changes.

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
`@commerce/plugins`, Apps page, `docs/plugins.md`).

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

**Storefront.** Host-based routing via `proxy.ts`, Glide-derived theme, home and pages from
Puck, product page with delivery estimate and EMI hint, cart, checkout (payment methods,
discount codes, pincode serviceability), thank-you with manual payment instructions,
collection pages, cart recovery links.

Migrations are at `0035`. Tests: 17 vitest projects, all green; `bun run test` from the root.

## Open loose ends

1. **Accept-invitation route** — staff invites send but cannot be joined yet (Better Auth
   accept endpoint needs a page).
2. **`bun run db:seed:demo` is not idempotent** — fails on existing customers; the collections
   seed is fine.
3. Order status duplicates payment and shipment state (`paid`, `fulfilled`, `delivered`);
   worth reducing to `open | cancelled` and deriving the rest. Schema change, own PR.
4. Parallel worktrees share the dev and test databases, so migration numbers collide and the
   `__drizzle_migrations` log drifts. Per-worktree database names would fix it.
5. A lint rule for the client-imports-server-value trap.
6. Sections still on empty states: Content (files beyond the media library, metaobjects),
   Marketing, Online Store (themes, navigation, blog, preferences), Settings (domains,
   invoices), Products sub-pages (inventory, transfers, gift cards).

## Next in the pipeline

Navigation editor, theme editor (store colours and fonts to storefront CSS vars), remaining
Glide sections as Puck blocks, storefront search, shopper accounts, SEO and JSON-LD, Motion
animations; then backend scale work (domain events with a transactional outbox, observability,
idempotency keys, read caching, rate limits); then GST invoices, returns and RTO, abandoned
cart automation, Snapmint direct adapter; then deployment (AWS ECS pipeline, Cloudflare,
Lambda@Edge routing) and the SaaS layer (onboarding, tenant billing, plugin marketplace).

See `docs/architecture.md` for the target architecture and the ordered scale roadmap.
