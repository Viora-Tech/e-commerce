# Guardrails consistency: one home per helper, new sweeps

**Branch** `fix/guardrails-consistency` (1 October 2026), from the 2026-10-01 architecture audit.
Merges after #217–#220 (it contains the #217 Decentro merge). No migration. Pure refactors except
one bug fix (admin upload size gate). What a new session needs to know:

- **Single homes, each with a SOURCE OF TRUTH note at the owner:** `settingsSecret()`
  (`@commerce/config`), `safeEqual` (`@commerce/payments`; shipping's `timingSafeEqualString`
  is the same function), `isUniqueViolation` (`@commerce/db`), `parseRupees` /
  `formatSignedMoney` / `formatPercent` (`@commerce/money`), `slugify`
  (`@commerce/core/catalog`), `initials` (`apps/admin/src/lib/initials.ts`), `sentryOptions`
  (`@commerce/observability`), `redisRateLimiter` (`@commerce/queue`; the apps'
  `lib/rate-limit.ts` are one-line `server-only` doors).
- **New package `@commerce/dates`** (pure, client-safe): `formatInZone`, `dayKey`, `dayStart`,
  `startOfDay`, `startOfMonth`, `wallClock`, `zoneOffsetMs`, `IST_OFFSET_MS`,
  `DEFAULT_TIME_ZONE`. Admin: `useFormat().pattern(value, options)`, `formatNumericDate`,
  `todayKey` in `lib/format-date.ts`. Never build an `Intl.DateTimeFormat` in a component.
- **Statuses from core:** `ORDER_MARKS` and `OPEN_ATTEMPT_STATUSES` via
  `@commerce/core/order-status`, `TRANSFER_STATUSES` via `@commerce/core/inventory`, marketing
  status types via `@commerce/core/marketing`.
- **Router limits:** `PAGE_SIZE_MAX`, `PAGE_MAX`, `SEARCH_MAX`, `BULK_MAX` in
  `packages/api/src/procedures/limits.ts`.
- **Admin courier/Decentro apps** share `components/apps/shared` (`ProviderConnectPage`,
  `ProviderOverviewPage`, `CourierConnectGuide`, `readTestedFlag`).
- **`server-only`** now opens every storefront `lib/` module that reaches server packages.
  Vitest does not set `react-server`, so the storefront and api vitest configs alias
  `server-only` to an empty stub (otherwise the cross-store leak test silently skips loaders).
- **Bug fixed:** the admin upload gate allowed 25 MB while the server refuses images over
  10 MB; it now reads `maxUploadBytesFor` from `@commerce/storage/keys` (images 10 MB, mp4
  100 MB). Return photos: `RETURN_PHOTO_MAX_BYTES` (5 MB), one constant.
- **#217 merge fix:** `checkQrPaymentAction` took the store id from the browser (failed the
  storefront-action-store sweep); it now uses `requestStoreId()`.
- **New sweeps** (`docs/guardrails.md` m–t): near-duplicate-files, duplicate-helpers,
  date-format, server-only-guard, status-literals, domain-errors, router-magic-limits,
  file-size; hardcoded-colours also catches Tailwind palette classes; service-layer is per
  file; no-orphans has a stale-entry check (49 stale names removed).

**Follow-ups now done** (after #220–#224 merged): the IST offset copies in `packages/invoices`,
`plugin-gst-invoices` and the admin GST screens, `msUntilLaunch`/`formatCountdown` copies in
`packages/blocks` (now `msUntil`/`formatCountdown` in `@commerce/dates`, since blocks cannot
import core), the date formatters in the GST, theme and blocks code, and the metaobjects /
gst-invoices router limits. What remains is on the sweep allow-lists with real reasons
(e.g. GST search box and register paging stay shorter than the shared limits).
