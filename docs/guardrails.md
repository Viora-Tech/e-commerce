# Architecture guardrails

`bun run test:sweeps` runs a set of vitest "sweeps" over the whole repo — static checks
that are cheaper than a code review and catch drift a human won't notice across 1,400+
files. They run in CI (`.github/workflows/ci.yml`) after `bun run lint` and
`bun run typecheck`, before `bun run test`.

Shared walking/parsing code lives in `scripts/sweeps/walk.ts` (lists `.ts`/`.tsx` files
under given repo-relative roots, parses imports/exports with the TypeScript compiler
API — the same approach `scripts/check-components.ts` already uses). The finders behind the
consistency sweeps (m–t below) live in `scripts/sweeps/consistency.ts`, so one can be run on
its own when rebuilding an allow-list.

## The ratchet pattern

Every sweep here is a **ratchet**, not a big-bang fix: each one has a typed `ALLOWLIST`
constant next to it, listing every violation that existed on the day the sweep was
added, each with a one-line reason. The sweep passes today because every current
violation is on the list. It fails the moment someone adds a **new** one that isn't.

- **Fixing** a violation (moving a query behind a service, deleting a `dangerouslySetInnerHTML`,
  wiring up an "orphan" export) means removing its allow-list entry — the list should only
  shrink over time.
- **Allow-listing** a new, deliberate exception means adding an entry with a real reason —
  not just to make the sweep pass. If you can't explain why in one line, fix it instead.
- Every ratchet sweep also asserts its allow-list has **no stale entries** — if you fix a
  violation but forget to delete its allow-list row, that test fails too, so the list stays
  honest.

`dead-code` is the one exception: it's not a ratchet, it's a fixed "these must never come
back" list (see below).

## The sweeps

### a. `service-layer` (`scripts/sweeps/service-layer.test.ts`)

Direct `@commerce/db` / `drizzle-orm` value-imports are only allowed in the service layer:
`packages/core`, `packages/db`, `packages/api/src/services`, and `scripts/`. Everywhere
else (app routes, the worker, plugin packages) should go through a core service function
instead of touching the db client directly.

**Fix a violation**: move the query into a `packages/core` (or `packages/api/src/services`)
function and call that instead. **Allow-list**: one entry per file (`exact: true`) with a
reason. Since 2026-10-01 there are no folder entries for `apps/` or the plugins, so a new
file in the storefront, the worker or a plugin that reads the db directly fails even though
its neighbours are listed.

### b. `client-imports-server` (`scripts/sweeps/client-imports-server.test.ts`)

A `'use client'` module must not VALUE-import anything from a server-only package —
`@commerce/core`, `@commerce/db`, `@commerce/auth`, `@commerce/storage`(`-r2`),
`@commerce/payments`(`-razorpay`), `@commerce/shipping`(`-delhivery`/`-shiprocket`),
`@commerce/api`. `import type` is always fine. `@commerce/core`/`@commerce/db` are already
enforced as part of `bun run lint` by `scripts/check-components.ts` — this sweep re-asserts
that and extends it to the rest of the server-only surface (see "server-only" below).

**Fix**: import types only, or move the value you need behind a pure client-safe subpath
(e.g. `@commerce/core/catalog`) the way `docs/conventions.md` describes.

### c. `no-orphans` (`scripts/sweeps/no-orphans.test.ts`)

An exported function/const/class in `packages/*/src` with no importer anywhere else in
the repo is an orphan. Types are exempt. Test-only use doesn't count. A package's public
entry (its `package.json` `exports` targets) counts as consumed as soon as *anything*
imports that package at all — its named exports are its public API surface, not
individually tracked.

**Fix**: wire the export up, or delete it. **Allow-list**: add `{ file, names, reason }` —
usually `'no external importer today — investigate before removing'` is enough; a more
specific reason is better if you know one (e.g. "kept for an upcoming PR"). A listed name
that gains an importer (or whose file becomes a consumed package entry) is stale and fails
the second test, so remove it.

### d. `dead-code` (`scripts/sweeps/dead-code.test.ts`)

Not a ratchet — a fixed list of paths and dependencies that were deliberately removed and
must never come back (`REMOVED_PATHS`, `REMOVED_DEPENDENCIES`). Currently: the India order
map component/data (`india-order-map.tsx`, `data/india-map.ts`), `@svg-maps/india`, and
`@measured/puck`. Add to this list whenever you delete something that a merge, revert, or
copy-paste could plausibly reintroduce.

### e. `dangerous-html` (`scripts/sweeps/dangerous-html.test.ts`)

Every `dangerouslySetInnerHTML` usage must be on the allow-list, with a reason. It's a real
XSS surface — a reason should say why the HTML is safe (fully static/self-built, like a
`<style>` tag or JSON-LD, or already sanitised, like rich text through `packages/richtext`),
never "it's fine".

**Fix**: don't use `dangerouslySetInnerHTML` for anything that could contain user input
without going through `packages/richtext` (or equivalent) sanitisation first.

### f. `money-format` (`scripts/sweeps/money-format.test.ts`)

Every `Intl.NumberFormat(...)` call site outside `@commerce/money` (`packages/money`) is on
the allow-list. That module is the one currency-aware home (INR/EUR/USD): `formatMoney`,
`formatNumber`, `formatSignedMoney` ("+₹49" / "−₹99.98"), `formatPercent` and `parseRupees`
(typed rupees → paise). The admin reaches it through `useFormat()` (`lib/format.ts`) and
`lib/money.ts`; the storefront and blocks through `formatPaise` in `packages/blocks/src/money.ts`.
Today the only allow-listed site is the animated counter's digit regrouping (`count-up.tsx`).
Hand-built `₹${...}` strings are caught by review and the duplicate-helpers sweep (`inr`,
`formatSigned`, `toPaise` must not come back), not by this one.

### g. `hardcoded-colours` (`scripts/sweeps/hardcoded-colours.test.ts`)

Hex colour literals (`#fff`, `#a1b2c3`) in `.tsx` UI files under the app/component/block/
editor roots (not the vendored `packages/ui/src/components/shadcn/**`), outside the
allow-list. Per `docs/conventions.md`, UI code should read CSS variables from
`globals.css`, never hardcode a colour. Scope excludes token/palette *definitions*
(`packages/core/src/theme/**`, email themes, invoice PDF templates) — those are where hex
colours legitimately live; this sweep is about UI code that should be reading a token
instead (e.g. `product-categories-card.tsx`, `gst-invoices/look-group.tsx`).

**Fix**: replace the hex literal with a CSS variable / token. **Allow-list**: only for UI
that inherently renders a user- or merchant-chosen raw colour (a swatch picker, an email
preview of someone else's inline styles).

The same scope is also checked for **Tailwind palette classes** (`bg-red-500`,
`text-neutral-700`, `ring-gray-200/50`): they are raw colours that only look like utilities.
Use the tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `text-destructive`).
Own allow-list: `PALETTE_ALLOWLIST` (today the printed packing slip and the theme editor's
preview overlay).

### h. `source-of-truth-header` (`scripts/sweeps/source-of-truth-header.test.ts`)

New files under `packages/core/src` and `packages/plugins/src` must start with:

```ts
/** SOURCE OF TRUTH: <keywords> — WHAT / WHY */
```

so it's obvious at a glance which module owns a piece of business logic. Enforcement is a
frozen snapshot (`EXISTING_FILES`) of every file that existed in those two packages when
this sweep was added — anything **not** in the snapshot is "new" and needs the header.
This avoids a `git diff`-against-main dependency (works in a shallow clone, or a plain
`bun run test:sweeps` with no git history), at the cost of never retroactively checking
existing files. That's an accepted trade-off, not a bug.

### i. `secret-fields` (`scripts/sweeps/secret-fields.test.ts`)

Not a ratchet — every provider config field across `payments-*`, `shipping-*`,
`notifications-*` and `storage-*` connectors is already flagged correctly, so any
violation here is new and should be fixed, not allow-listed. A `ProviderField` whose
`key` matches `/secret|token|password/i` (case-insensitive, whole word — see the sweep's
own comment for why substrings like "key" or "pin" are deliberately excluded) must
declare `secret: true`. A second check round-trips every real connector factory through
`encryptProviderSettings` and confirms flagged fields come back encrypted and decrypt to
the original value. See `docs/security/data-protection.md` for what this feeds into
(encryption, masking, rotation) and why the field flag is the source of truth, not just
the name regex.

## Cross-store leak test (DB-backed, in `bun run test`)

`packages/api/test/cross-store-leak.test.ts`. Not a static sweep: it runs against Postgres
with the api suite, but it is a guardrail in the same spirit, and it covers new code without
anyone editing it.

1. **Two stores, every table.** `seedEveryTable` (`packages/db/test/seed-every-table.ts`,
   exported as `@commerce/db/test/seed`) reads the catalogue and puts rows in every table
   that has a `store_id`, for store A and store B, parents before children, values shaped to
   pass each column's type and `in (...)` checks. A table added next month is seeded
   automatically; the test fails if the seeder cannot fill one.
2. **Walk the whole router.** Signed in as store A's owner, it calls every procedure in
   `appRouter` twice, with an input built from the procedure's own Zod schema
   (`test/support/sample-input.ts`): once with store A's ids, once with store B's ids as a
   probe. It then calls every exported loader in `apps/storefront/src/lib` whose first
   argument is `tx`, inside store A's `withStore`, with A's and B's handles.
3. **It fails when** a response (or an error message) holds any id or seeded value of store
   B other than an id the call itself passed in; when any of store B's rows changed; or when
   any of store A's rows now holds one of store B's ids (A linked B's data into its own, which
   RLS does not stop because foreign-key checks bypass it).

**Fix a finding** in the service: read the referenced row under RLS before writing a
reference to it (see `addOrderNote` and `assertOwnSegment` in campaigns, the two this test
found when it was added). **SKIP** (top of the file) is only for procedures that reach an
outside service (gateway, courier, mailer, Shopify, DNS) or that would end the walk (switch
or delete the store under test), each with its reason. The test also asserts a coverage
floor (60% of callable procedures answer at least one call without an error) so a broken
input generator cannot pass silently, and it checks its own detector on a planted leak.

### j. `pinned-actions` (`scripts/sweeps/pinned-actions.test.ts`)

Not a ratchet. Every `uses:` in `.github/workflows/*.yml` must be `owner/repo@<40-hex SHA> # vX.Y.Z`
(security audit D-02): a tag can be moved by whoever controls the action's repository, and the
release job holds a GHCR write token. **Fix**: look up the release's commit
(`gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`) and pin it with the tag as a comment.

### k. `deploy-compose` (`scripts/sweeps/deploy-compose.test.ts`)

Not a ratchet. Every key in `packages/config/src/env.ts` reaches the apps through `x-app-env`
in `deploy/docker-compose.prod.yml` and is documented in `deploy/env.production.example`, except
a short `NOT_FOR_APPS` list with reasons (dev-only and backup-only keys). Postgres, Dragonfly
and migrate stay on the `internal` network only; worker and backup also join `egress`
(security audit D-12).

### l. `storefront-action-store` (`scripts/sweeps/storefront-action-store.test.ts`)

Not a ratchet. No exported function of a `'use server'` file under `apps/storefront/src` may take
the store id as its first parameter (`storeId`, `store`, `bound`): every server action is an
endpoint the browser can call with any arguments, so the store comes from the hostname
(`requestStoreId()` / `x-store-id`, set by `proxy.ts`). Security audit D-13.

### m. `near-duplicate-files` (`scripts/sweeps/near-duplicate-files.test.ts`)

Two source files over 40 normalised lines (trimmed, no blanks, imports or comments) that
share 85% or more of their lines are a copy that will drift. **Fix**: one owner with options
(find, extend, then create), as the courier connect/overview pages now share
`components/apps/shared`. **Allow-list**: `{ pair: 'a <-> b', reason }`.

### n. `duplicate-helpers` (`scripts/sweeps/duplicate-helpers.test.ts`)

`HELPER_OWNERS` in `consistency.ts` names each single-home helper and its owner file:
`settingsSecret` (@commerce/config), `safeEqual` (@commerce/payments), `isUniqueViolation`
(@commerce/db), `parseRupees`/`formatSignedMoney`/`formatPercent` (@commerce/money),
`IST_OFFSET_MS` (@commerce/dates), `slugify`/`msUntilLaunch` (core), `initials` (admin lib),
`sentryOptions` (@commerce/observability), `redisRateLimiter` (@commerce/queue), ... A
function or const with one of those names declared anywhere else fails; names with no owner
(`toPaise`, `inr`, `todayIst`, `formatSigned`) were folded into an owner and must not come
back. A third test forbids `loadEnv(process.env).SETTINGS_SECRET` outside @commerce/config.
**Fix**: import the owner. **Add a helper**: give it an owner note and a `HELPER_OWNERS` row.

### o. `date-format` (`scripts/sweeps/date-format.test.ts`)

`Intl.DateTimeFormat`, `toLocaleDateString`, `toLocaleTimeString` and
`toLocaleString(locale, options)` outside `@commerce/dates`. Without a pinned zone the
server (UTC) and the browser (IST) disagree on the day and the text — a hydration error.
**Fix**: `formatInZone` (store timezone) from `@commerce/dates`; in admin components
`useFormat()` (`date`, `dateTime`, `when`, `pattern`) or `lib/format-date.ts`
(`formatPattern`, `formatNumericDate`, `todayKey`). Day maths (`dayKey`, `startOfDay`,
`startOfMonth`, `wallClock`) lives there too. **Allow-list**: per file with a reason.

### p. `server-only-guard` (`scripts/sweeps/server-only-guard.test.ts`)

See `server-only` below: app `lib/` modules that value-import a server package or
`@commerce/config` must start with `import 'server-only'`. Not allow-listed today.

### q. `status-literals` (`scripts/sweeps/status-literals.test.ts`)

UI code (admin, storefront, blocks) must not restate one of core's status lists
(order lifecycle/payment/fulfilment, `ORDER_MARKS`, `OPEN_ATTEMPT_STATUSES`,
`PURCHASE_ORDER_STATUSES`, `TRANSFER_STATUSES`) as a literal array, and must not import a
`...Status` type from `@commerce/db`. **Fix**: import from `@commerce/core/order-status`,
`@commerce/core/inventory`, `@commerce/core/marketing`. Not allow-listed today.

### r. `domain-errors` (`scripts/sweeps/domain-errors.test.ts`)

A new `class X extends Error` in core, the API or a plugin must extend `CommerceError`
(`packages/core/src/errors.ts`: a stable `code` the admin narrows on). Routers may not add a
bare `throw new Error(...)`: the per-file count in `ROUTER_THROWS` may only go down.

### s. `router-magic-limits` (`scripts/sweeps/router-magic-limits.test.ts`)

`.max(<number>)` on a `perPage`/`page`/`limit`/`search`/`query`/`q`/`ids`-style router input.
**Fix**: `PAGE_SIZE_MAX`, `PAGE_MAX`, `SEARCH_MAX`, `BULK_MAX` from `../procedures`
(`packages/api/src/procedures/limits.ts`). **Allow-list**: a deliberately different
ceiling (a 12-row picker, a 100-order courier batch), with why.

### t. `file-size` (`scripts/sweeps/file-size.test.ts`)

A `.ts` module (not tests or migrations) over 500 lines. Listed files may grow by at most 50
lines past their recorded size; one that drops under 500 must leave the list.

## `server-only`

The `server-only` npm package throws unconditionally when the bundler resolving it does
not set the `"react-server"` export condition — which Next.js sets during its RSC/server
compilation, but **Bun and vitest do not**. Since `apps/worker` and every package's vitest
suite import `packages/core`, `packages/db`, `packages/auth`, the storage/payments/shipping
connector packages, and `packages/api` directly (not through Next), putting
`import 'server-only'` inside those *shared* packages would throw at import time under
`bun run` and `bun run test:sweeps`/`vitest` — breaking the worker and every test suite
that touches them.

So `server-only` is used only where it's safe: **app-level Next modules**, where Next
correctly sets the export condition either way (empty module server-side, hard error if a
client bundle ever pulls it in). Every module under `apps/admin/src/lib` and
`apps/storefront/src/lib` that value-imports a server package (or `@commerce/config`) starts
with `import 'server-only'`; the `server-only-guard` sweep (p) enforces it.

Tests that import those modules (the storefront's own vitest suite, and the api suite's
cross-store leak test, which walks every storefront loader) alias `server-only` to an empty
stub in their `vitest.config.ts` (`apps/storefront/test/server-only.ts`,
`packages/api/test/support/server-only.ts`). Without it the leak test would silently skip
every guarded loader (it `continue`s on import errors).

For the shared packages themselves (`packages/core`, `packages/db`, `packages/auth`,
storage/payments/shipping connectors, `packages/api`), the guardrail is **static, not
runtime**: the `client-imports-server` sweep above (plus `scripts/check-components.ts` for
`@commerce/core`/`@commerce/db`) forbids a `'use client'` module from value-importing them
at all, which is the actual failure mode `server-only` protects against in a Next app —
without the runtime footgun of breaking Bun/vitest consumers.

Proof this doesn't break anything: `apps/worker/src/index.ts` still bundles cleanly with
`bun build --target=bun` (`bun apps/worker/src/index.ts --help` also runs), and
`bun run test:sweeps` / `bun run typecheck` pass across all 30 packages.

## Router idiom: `can()` vs bare `storeProcedure`

Every `packages/api/src/routers/*.ts` handler that changes or reads store-wide data is
gated with `can(permission)` (`../procedures`), which requires the caller's role to hold
that grant. Two routers also use the bare `storeProcedure` (no permission) for specific
handlers, deliberately:

- `appearance.get` / `appearance.setMine` — every store member may read and set their
  *own* accent colour pick; there is no permission to check because the data is
  self-scoped (keyed on `scope.userId`), not store-wide.
- `staff.me` — every member may read their own resolved role/permissions; same reasoning,
  it drives which controls the admin renders for the caller and touches no one else's data.

`appearance.setStoreDefault` is the one store-wide mutation in that router; it stays on
bare `storeProcedure` with an explicit `if (!context.scope.isOwner) throw ...` check rather
than `can()`, because "set the organisation's default accent" is owner-only by definition,
not a granular permission grain in the roles model (`packages/core/src/permissions`).

Rule: a handler may use bare `storeProcedure` only when it reads or writes data scoped to
the calling member themselves (`scope.userId`) and never another member's or the store's
shared data. Anything else — including an owner-only action — should either call
`can(permission)` or, if it truly has no corresponding permission grain, gate explicitly
on `scope.isOwner` the way `appearance.setStoreDefault` does, with a comment saying why.

## Running the sweeps

```sh
bun run test:sweeps          # all sweeps
bun run test:sweeps -- scripts/sweeps/service-layer.test.ts   # one sweep
```

They're plain vitest tests (`scripts/sweeps/vitest.config.ts`), so normal vitest flags
work (`--reporter=verbose`, `-t "no-orphans"`, etc).
