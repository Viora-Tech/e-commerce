---
name: koomerce-plugin-app
description: Build or change a Koomerce app (plugin) in this monorepo, such as a courier, payment gateway, notification channel, storage connection or built-in app. Use when touching definePlugin manifests, the access declaration, the "Untested" badge, app settings pages under /apps/<id>, app hooks and jobs, order actions, app blocks, or commerce.config.ts / commerce.blocks.config.ts.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Building a Koomerce app

The SDK reference is `apps/docs/content/developer-docs/building/plugins.mdx` and the tutorial is
`apps/docs/content/developer-docs/building/first-app.mdx`. Read the section you need there; this
skill is the checklist and the rules that bite.

## Where things live

| What | Where |
| --- | --- |
| `definePlugin`, `defineConfig`, `loadPlugins`, manifest types | `packages/plugins/src/define.ts`, `load.ts`, `types.ts` |
| Which plugins this deployment ships | `commerce.config.ts` (root) |
| Client-safe list of app blocks for the editor | `commerce.blocks.config.ts` (root) |
| Admin page components per app | `apps/admin/src/apps/registry.ts` (`ADMIN_APPS[pluginId].pages[path]`) |
| Admin page code | `apps/admin/src/components/apps/<app>/` (for example `delivery-options/`) |
| Order action procedures | `apps/admin/src/apps/order-action-procedures.ts` |
| App API router | `packages/api/src/routers/<app>.ts`, mounted in `packages/api/src/routers/_app.ts` |
| App settings without a table | `appSettingsOf` / `withAppSettings`, `packages/core/src/apps/settings.ts` |
| App Store catalogue (generated) | `packages/core/src/apps/catalogue.generated.ts` via `bun scripts/gen-app-catalogue.ts` |
| Prices | `APP_PRICING`, `packages/core/src/billing/apps.ts` |

Worked examples: `packages/plugin-back-in-stock` (the tutorial's shape), `packages/plugin-forms`
(smallest app with a table), `packages/plugin-emi` (settings in `store.apps`, no table),
`packages/plugin-reviews` (tables, storefront, emails), `packages/payments-cashfree` (compact
gateway), `packages/shipping-xpressbees` (courier with login token cache and HMAC webhooks).

## Manifest checklist

1. `id`: lowercase slug, stable forever (stored on orders).
2. `kind`: `'builtin'` or `'connection'` (required; `definePlugin` throws without it). A
   connection also sets `company` and a standard `category`
   (`storage | payments | shipping | messages | analytics | marketing`).
3. `access` (required): every store resource the code touches with `read`, `write` or
   `read-write` and a plain `why`; `shares` for what leaves the platform. Declare exactly what
   the code does, never more or less. When you add a call that reads a new resource (for
   example Shipping rates), add the resource here in the same change.
4. `tested`: set `tested: true` only after the owner confirms the app ran end to end on a live
   store. Without it the admin shows the "Untested" badge. It is a one-line change per app,
   recorded in a handoff note (see `docs/handoff/changes/2026-11-17-apps-tested-badges.md`).
5. `listing` for the App Store website (`apps/www`); then run `bun scripts/gen-app-catalogue.ts`
   (the `app-catalogue` sweep fails while the generated file is stale).
6. `credits` when code is adapted from open source, plus `THIRD_PARTY_NOTICES.md`.

Field-by-field detail: [manifest-reference.md](manifest-reference.md).

## Settings pages

- Pages are declared in the manifest (`admin.pages: [{ path, title, navLabel?, icon? }]`) and
  rendered at `/apps/<pluginId>/<path>`. Installed apps never mount inside Settings.
- Register the component in `apps/admin/src/apps/registry.ts` under the same path keys
  (`''` is the app root). `admin.icon` must be a name in the icon map in `apps/admin/src/apps/app-icons.ts`, else it
  falls back to a generic icon.
- The component follows the `koomerce-conventions` skill (copy in `apps/admin/src/data/<app>.ts`,
  Hindi in `data/hi/`).
- The router checks `can(permission)` and that the app is installed
  (`PRECONDITION_FAILED` otherwise). The API depends on the plugin, never the reverse.
- A few switches: keep them in `store.apps.settings[id]` (zod schema written field by field, not
  `Schema.partial()`, which fills defaults in zod 4). Any writer of `store.apps` must take
  `lockStoreApps` first (`packages/core/src/apps/locked.ts`, sweep `store-apps-writes`).
- An app with its own connection in settings sets `setupState(settings)` so Installed apps shows
  Connected, Needs setup or Error.

## Tables, hooks, blocks

- Own tables: export from the app's `schema.ts`, list it in `packages/db/drizzle.config.ts`,
  carry `store_id`, and end the migration with `SELECT apply_store_rls();`. Migration ordering
  rules are in the `koomerce-release-flow` skill.
- Hooks (`order.paid`, `order.fulfilled`, `order.delivered`, `refund.created`,
  `customer.created`, `customer.updated`) run at least once: make them idempotent.
- App blocks: type `<pluginId>/<Name>`, read data only from `puck.metadata.appBlockContext`,
  and add the same block array to both the manifest and `commerce.blocks.config.ts`.

## Tests

- Providers run their contract's conformance suite (`describeShippingProvider`,
  `describePaymentProvider`, `describeNotificationChannel`, `describeStorageProvider`, each in
  `packages/<kind>/src/conformance.ts`) with `fetch` mocked; live checks only with sandbox keys
  from env.
- Block render: `packages/blocks/test/render.test.tsx`; builder: `packages/blocks/test/app-blocks.test.ts`.
- Then the sweeps most apps trip: `no-orphans`, `client-imports-server`, `app-catalogue`,
  `service-layer`. See the `koomerce-testing` skill for how to run them on this machine.
