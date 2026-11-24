---
name: koomerce-app-developer
description: Build a Koomerce app (plugin) - a payment gateway, courier, notification channel, storage connection or a built-in feature app with admin pages, order hooks, background jobs, order actions and storefront app blocks. Use when writing or reviewing a definePlugin manifest, its access declaration, provider factories and their conformance tests, app settings, or app blocks for the Koomerce theme editor.
license: MIT
compatibility: For the Koomerce commerce monorepo (github.com/Viora-Tech/e-commerce), Bun and TypeScript.
metadata:
  author: Viora-Tech
  koomerce-version: "Koomerce platform, November 2026"
  version: "1.0"
---

# Building a Koomerce app

A Koomerce app is a workspace or npm package that exports a manifest made with `definePlugin`
from `@commerce/plugins`. The deployment lists it in `commerce.config.ts`; each store installs
it from the App Store and only then do its providers, hooks, pages and blocks run for that store.
The platform never imports an adapter directly.

Full reference: the developer docs pages "Plugins SDK and app blocks" and "Build your first app
in 15 minutes" (`apps/docs/content/developer-docs/building/plugins.mdx` and `first-app.mdx` in the
repo). Field list: [references/manifest.md](references/manifest.md).

## Step by step

1. **Package**: `packages/<name>/` with `src/plugin.ts` (manifest), `src/index.ts`, the provider
   or server code, and tests. Depend on `@commerce/plugins` and the contract package you
   implement (`@commerce/payments`, `@commerce/shipping`, `@commerce/notifications`,
   `@commerce/storage`).
2. **Manifest**: `id` (lowercase slug, never changes), `name`, `version`, `kind`
   (`'builtin'` or `'connection'`) and `access` are required; add a `description`. A
   connection also sets `company` and a `category` (`storage`, `payments`, `shipping`,
   `messages`, `analytics`, `marketing`).
3. **Access, honestly**: list every store resource the code reads or writes with `read`,
   `write` or `read-write` and a plain `why`, and `shares` for anything sent to an outside
   service. Merchants see this before they install. Never declare more or less than the code does.
4. **Provider** (for a connection): a factory with `fields` (they generate the settings form;
   `secret: true` fields are encrypted at rest and masked), `validateConfig`, and `create`.
5. **Admin pages**: declare `admin.pages` in the manifest (rendered at `/apps/<id>/<path>`) and
   register the React components in the admin app's registry (`apps/admin/src/apps/registry.ts`).
   App procedures live in `packages/api/src/routers/<app>.ts`, behind `can(permission)` and an
   installed check.
6. **Settings**: a few switches go in the store's app settings JSON
   (`appSettingsOf` / `withAppSettings`); more data gets the app's own tables with `store_id` and
   row-level security (`SELECT apply_store_rls();` at the end of the migration).
7. **Hooks and jobs**: `order.paid`, `order.fulfilled`, `order.delivered`, `refund.created`,
   `customer.created`, `customer.updated` run in the worker at least once. Make them idempotent.
8. **App blocks** (optional): `storefront.blocks` with types named `<id>/<Name>`; a block reads
   its data from `puck.metadata.appBlockContext` and never fetches. Add the same block array to
   `commerce.blocks.config.ts` so the theme editor can preview it.
9. **Register**: add the plugin to `commerce.config.ts`. With a `listing`, regenerate the App
   Store catalogue (`bun scripts/gen-app-catalogue.ts`).

## Rules every app follows

- Ids are stable forever (they are stored on orders).
- Couriers throw `CourierError` for transport or auth failures and return
  `serviceable: false` for a real "no"; they return transit days, never dates.
- Payment webhooks verify signatures with a constant-time compare and return a stable `eventId`.
- Notification channels return `{ ok, providerRef?, error? }` and never throw for a rejected
  recipient.
- Calls to a merchant-supplied host go through `@commerce/core/safe-fetch`.
- No secrets in code, tests or fixtures. Live checks read sandbox keys from the environment.
- Credit adapted open-source code in the manifest's `credits` and keep its licence.
- A new app shows an "Untested" badge until the maintainers have run it end to end on a live
  store and set `tested: true`. Do not set it yourself.

## Tests

- Run your contract's conformance suite (`describePaymentProvider`, `describeShippingProvider`,
  `describeNotificationChannel` or `describeStorageProvider`) with `fetch` mocked; add `live: true`
  only with sandbox credentials from the environment.
- One test per API call, plus tampered and expired webhook cases.
- Hooks: run the handler twice for one order and assert one effect.
- Blocks: render with `defaultProps`.
- Repo checks: `bun run lint:components` for React files and the guardrail sweeps
  (`bun run test:sweeps`), which catch unused exports, server code in client modules and a stale
  App Store catalogue.

## Before you open a pull request

- PRs target the `dev` branch and add a note in `docs/handoff/changes/YYYY-MM-DD-title.md`.
- React files follow the repo's one-component structure, copy in `data/<feature>.ts`, sizes in
  rem, Tailwind only (`docs/conventions.md`).
