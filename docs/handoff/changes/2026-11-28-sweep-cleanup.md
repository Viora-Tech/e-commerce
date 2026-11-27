# Sweep offenders from release #1809 cleaned up

Branch `chore/sweep-cleanup-nov28` (from `origin/dev` 8c459e08c). No issue. No migration. No behaviour change.

## What changed

- **Unused exports** (`no-orphans`):
  - `planPriceFor` (`packages/core/src/billing/founding-offer.ts`) deleted: nothing used it. Its test lines now
    check `foundingApplies` for the same months.
  - `PORTAL_SUBDOMAIN`, `primaryCustomDomain`, `portalHostnameFor` (`packages/core/src/domains/portal.ts`),
    `PORTRAIT_COPY` (`packages/core/src/media/compact-video.ts`), `optionAllows`
    (`packages/core/src/shipping/delivery-options/pick.ts`) and `mix`
    (`packages/invoices/src/templates/polish-style.ts`) are module-private now. Tests go through the
    public functions instead (`portalHostname`, `copyShapeFor`, `palette`); the worker's
    `video-ffmpeg.test.ts` takes the phone shape from `copyShapeFor`.
  - `stripItems` moved from `polish-head.tsx` to a new pure `packages/invoices/src/templates/polish-meta.ts`,
    which `polish-head.tsx` imports.
- **SOURCE OF TRUTH header** added to `packages/core/src/domains/portal.ts`.
- **`apps/storefront/src/lib/render-gate.ts`** now starts with `import 'server-only'`. Only server modules
  import it: `proxy.ts`, `liquid-theme.ts`, `render-slot.ts` and `memory-report.ts`.
- **`initials` in polish-style.ts** (`duplicate-helpers`) renamed to `logoMonogram`. It is a different rule
  from the admin's avatar `initials`: "S&S" joined with "&", for the invoice logo tile.
- **`apps/storefront/src/lib/liquid-theme.ts`** (765 lines → 325) split with no behaviour change:
  - `liquid-scope.ts`: `requestScope`, `liquidTemplateFor`, `finish`, `cacheScope`, `signedOut`.
  - `liquid-context.ts`: `importedTheme`, `tracedContext`, `liquidContextFor`. It also holds the
    `./search-engine` side-effect import, because every render path goes through it.
  - `liquid-static-section.ts`: `requestThemeId`, `renderStaticLiquidSection`, `renderRecommendations`.
  - Importers were updated to use the new files: `inbox-logo`, `liquid-cards`, `liquid-editor-sections`,
    `predictive-route`, `recommendations-route` (and its `vi.mock`), `template-render` and the
    `theme-actions` route.
- **`apps/storefront/src/proxy.ts`** (626 lines → 392) split with no behaviour change. `proxy` and
  `config` stay in `proxy.ts`:
  - `lib/proxy-hosts.ts`: the host and market resolvers, plus `routeOwnHost`, which answers the
    accounts, checkout and portal hosts.
  - `lib/proxy-moves.ts`: `orderTokenMove`, `honoPreviewMove` and `marketMove`.
  - `lib/proxy-page-response.ts`: `finishPageResponse`, which sets the preview, market and visitor
    cookies, handles the referral, sets the shared cache header and records the cache-warm visit.
- Sweep allow-lists follow the moved code. In `file-size`, the `liquid-theme.ts` entry is gone. In
  `service-layer`, the `proxy.ts` entry became `lib/proxy-hosts.ts`, and the `liquid-theme.ts` entry
  became `liquid-context.ts` and `liquid-static-section.ts`.

## Tests

- `test:sweeps`: still the 27 pre-existing failures in 17 files, before and after. None of the
  offenders above appear any more.
- Typecheck passes for storefront, storefront-hono, worker, core and invoices.
- Vitest: storefront 957 passed, invoices 85, worker 99. In core, the touched pure files passed
  (founding-offer, portal, compact-video, delivery-options) with a no-database config. The
  database-backed `delivery-options/layout.test.ts` could not run because Docker was not running.
- `lint:components`: 223 errors, the same as the baseline.

## Left to do / for the owner to check

- On localhost, check that a storefront page, an affiliate portal host, a market prefix redirect and a
  theme preview cookie still behave as before.
