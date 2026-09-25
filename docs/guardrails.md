# Architecture guardrails

`bun run test:sweeps` runs a set of vitest "sweeps" over the whole repo — static checks
that are cheaper than a code review and catch drift a human won't notice across 1,400+
files. They run in CI (`.github/workflows/ci.yml`) after `bun run lint` and
`bun run typecheck`, before `bun run test`.

Shared walking/parsing code lives in `scripts/sweeps/walk.ts` (lists `.ts`/`.tsx` files
under given repo-relative roots, parses imports/exports with the TypeScript compiler
API — the same approach `scripts/check-components.ts` already uses).

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
- Two sweeps (`service-layer`, `client-imports-server`, `dangerous-html`, `money-format`,
  `hardcoded-colours`) also assert the allow-list has **no stale entries** — if you fix a
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
function and call that instead. **Allow-list**: add a folder or file entry with a reason
(grouped by folder where a whole area — e.g. `apps/worker/src/`, a plugin package's `src/`
— hasn't been routed through the service layer yet).

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
specific reason is better if you know one (e.g. "kept for an upcoming PR").

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

Every `Intl.NumberFormat(...)` call site outside a canonical money module is on the
allow-list. Today there are ~6 independent INR money helpers (`apps/admin/src/lib/money.ts`,
`apps/storefront/src/lib/money.ts`, `packages/blocks/src/money.ts`,
`packages/invoices/src/money.ts`, …) plus ~20 admin components formatting INR inline.

A follow-up PR adds a shared, currency-aware money module (INR/EUR/USD). Once it lands,
new formatting should import from it — the sweep is named `money-format`, not
`intl-number-format`, specifically so it's easy to re-point at that module instead of
`Intl.NumberFormat` directly.

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
client bundle ever pulls it in):

- `apps/admin/src/lib/db.ts`, `auth.ts`, `api.ts`, `rate-limit.ts`
- `apps/storefront/src/lib/db.ts`, `rate-limit.ts`, and all 11 `'use server'` action files
  (`*-actions.ts`)

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
