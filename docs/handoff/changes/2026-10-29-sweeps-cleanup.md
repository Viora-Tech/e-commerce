# Guardrail sweeps pass on dev again

`bun run test:sweeps` had 7 failing sweep files on dev (8 tests). It passes now: 26 files, 57 tests.
No sweep rule changed. Only allow-lists changed, and each new entry has its own reason.

**Fixed in code**
- **date-format:** `core/billing/service.ts` now builds the bill month label with `formatInZone` from `@commerce/dates`.
- **duplicate-helpers:** `apps/www/src/data/pricing.ts` dropped its own `inr` and uses `formatMoney` from `@commerce/money`. `@commerce/money` is now a dependency of `apps/www`. The output is the same.
- **site-config:** these now read `siteConfig.brand.name` instead of the literal brand:
  - `apps/admin/src/data/billing.ts` (the "unlimited" plan line)
  - `apps/admin/src/data/hi/billing.ts`
  - `core/testing/usage-seed.ts`
- **source-of-truth-header:** added headers to `core/preorder/note.ts` and `note.test.ts`.
- **no-orphans:**
  - **No longer exported** (they were only used inside their own file):
    - `APPROVAL_TTL_DAYS`, `monthVisits`, `salesOrderUrl`, `usageFeeSku`
    - `carriedInPaise`, `USAGE_BILL_MIN_PAISE`, `writeApprovals`, `shopifyNumericId`
    - the Shopify `*_QUERY` constants, plus `mapRules` and `mapOrder`, in the files they moved to
  - **Stale entries removed:** `PaymentFailed`, `PreorderLimitReached` and `orderNumberFromSearch` are imported now.
- **file-size, split by concern:**
  - `plugin-shopify-import/src/shopify-api.ts` went from 1011 to 388 lines (products and pre-order selling plans). The rest moved to:
    - `api-collections.ts`
    - `api-customers.ts`
    - `api-orders.ts`
    - `api-content.ts` (pages, articles, menus, redirects)
  - `api/services/ai/assistant/service.ts` went from 619 to 373 lines (the approval write flow). The rest moved to:
    - `views.ts`: how a row reads, plus the TTL and permission helpers
    - `activity.ts`: Activity, Approvals lists and the nav badge counts
  - `api/services/customer.service.ts` went from 565 to 499 lines. Saved segments moved to `customer-segment.service.ts`. Its file-size entry is removed.

**Allow-listed, with reasons**
- **file-size:** `core/billing/service.ts` (932 lines) and `core/order/place-order.ts` (1137 lines) are listed at their current size. Splitting them means refactoring checkout and billing code, which does not belong in a cleanup PR. Follow-up: #973.
- **service-layer:** `plugin-reviews/src/review-list-where.ts`. It is the Reviews list WHERE builder, split out of `reviews.ts`. It queries the plugin's own review tables, which `packages/core` cannot import, so it gets the same entry as its sibling files.
- **no-orphans:**
  - Exported only for unit tests:
    - `valueUnavailable`, `overFairUse`
    - `preorderCampaignsFromHtml`, `preorderAllowedFrom`
    - `mapCustomer` (in `api-customers.ts`)
  - The `usage-seed.ts` seeds, shared by four billing test suites.
  - `setStoreUnlimited`, used by `scripts/platform-unlimited.ts` (scripts are not scanned).
  - `REGIONAL_PRICING_LIVE`, `regionForCountry` and `regionalPrice`: the prices for outside India that the owner agreed. Nothing reads them until a gateway outside India exists.

**Not done:** #969, raising the leak test coverage floor back above 0.6. That needs the DB-backed api suite, which resets the shared test database. Other sessions were running at the time, so the test was not run here, and the floor stays at 0.59.

**Checked:**
- `bun run test:sweeps`
- biome on the changed files
- `tsc` for core, api, plugin-shopify-import, www and admin
- the unit tests for the Shopify plugin (pre-order, phone, variants, gift cards, visibility) and for the core pre-order note and regional prices
