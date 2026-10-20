# Guardrail sweeps green again on dev

Branch `chore/fix-guardrail-sweeps`. No migration, no behaviour change. `bun run test:sweeps` was
failing 23 tests in 17 files on `origin/dev` (billing, MCP/API access, sales channels, theme code,
analytics query and the 2026-10-20 merges #594-#606 landed without the sweeps). Now 54/54.

**Real fixes**
- `deploy-compose`: `AI_MAX_STEPS`, `DATABASE_POOLED`, `DATABASE_URL_DIRECT`, `GMC_GOOGLE_*`,
  `META_APP_*`, `PLATFORM_RAZORPAY_*` passed through `x-app-env` (`${X:-}`, blank = unset) and
  documented, commented out, in `deploy/env.production.example`.
- `site-config`: 22 files read `siteConfig.brand.name` instead of the literal. `apps/monitor` now
  depends on `@commerce/config` (pure `site` subpath only).
- `source-of-truth-header`: one-line headers on 31 new core files (two had it on line 2).
- `domain-errors`: `AppNotForSale`, `AutopayError`, `BillingNotReady`, `OAuthError` extend
  `CommerceError` (`OAuthError`'s code is still its OAuth error value).
- `no-orphans`: 45 exports used only in their own file lost `export`; 7 stale rows removed.
- `duplicate-helpers`: home range / home analytics import `IST_OFFSET_MS` from `@commerce/dates`.
- `date-format`: billing emails use `formatInZone`; the deleted `apps/docs/Dockerfile` left the
  ICU check's list.
- `admin-routes`: shipment page redirects with `routes.selectStore()`; one stale row removed.
- `status-literals`: orders bulk-edit takes `MARKS` from core's `ORDER_MARKS`.
- `near-duplicate-files`: 2 stale pairs removed.

**Allow-listed, each with its reason**: service-layer 9, file-size 10 new rows + 3 raised,
no-orphans 23 (15 test-only, 8 unwired billing/query/icon exports), router-magic-limits 6,
router-permissions 2 (`dashboard.tiles`/`setTiles`, own member), date-format 3,
duplicate-helpers 3, domain-errors 2 (parser-internal), dangerous-html 2, hardcoded-colours 2,
money-format 1, near-duplicate-files 1 (customers/orders bulk grids).

**Watch**: `product.service.ts` (501) and `billing/service.ts` (502) sit just over 500 lines; if
either drops under, its file-size row turns stale and the sweep fails until it is deleted.
