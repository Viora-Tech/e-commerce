# Guardrail sweeps pass again after the night merges (31 Oct)

`bun run test:sweeps` had 19 failing tests after the overnight merges (pre-orders, AI reports, A/B
rollouts, search & discovery, ShipGlobal, international checkout, market banner, home to-dos,
order archive, invoice view, pay online). No sweep rule changed. Most fixes are in code; the
allow-list entries that were added each carry a reason.

## Fixed in code

- **router-magic-limits:** no code change; see allow-list.
- **server-only-guard:** `storefront/src/lib/starter-menus.ts` now starts with `import 'server-only'`.
- **domain-errors:** `SearchPinLimitError` extends `CommerceError` (code `SEARCH_PIN_LIMIT`).
- **admin-routes:** the shipping profile page redirects with `routes.selectStore()`. In
  `data/settings-search.ts`, 16 plain links now use `routes.settings.*` / `routes.content.storage()`;
  its count went from 43 to 29 (the hash and query links stay).
- **site-config:** the `plan_bill` notification line reads `siteConfig.brand.name`.
- **money-format:** the catalog form's `minorDigits` is gone; it uses `minorDigits` from
  `@commerce/money` (the currency table), which is now exported.
- **date-format:** `formatInZone` from `@commerce/dates` in the review reward email (worker, which
  now depends on `@commerce/dates`), the AI period labels (and `dayKey` for "this year"), the
  reviews widgets' date line (still `en-GB` / UTC), printed document dates and the unpaid-cancel
  notice deadline. Stale `packing-slip.tsx` and `deliver.ts` entries removed.
- **service-layer:** the storefront's related products read picked handles through the new core
  `pickedRecommendationHandlesFor` instead of querying `product` in the component.
- **app-catalogue:** regenerated (`bun scripts/gen-app-catalogue.ts`).
- **source-of-truth-header:** headers on every new file in `packages/core/src` and
  `packages/plugins/src` (tests included); five files had the header on the second line of the
  comment and now start with `/** SOURCE OF TRUTH:`.
- **no-orphans:**
  - About 60 exports only used inside their own file are no longer exported.
  - Deleted (no user at all): `resolveTaxField`, `defaultCheckoutFields`,
    `RolloutAbOutcomeSchema`, `productsOfReviews`.
  - `DISCOVERY_RETENTION_DAYS` is now read by `retention/logs.ts`, which had its own copy of 90.
  - Stale entries removed: `splitName`, `checkGiftCardRules`, `EXPIRY_EXEMPT_METHODS`,
    `MANUAL_METHOD`, `retryPayment`, `settleExpiredQrAttempt`, `metafieldFacets`.

## file-size: split by concern

New sibling modules (callers import from the new path; core and inbox entries `export *` them):

| Module | Moved out to |
| --- | --- |
| `core/order/place-order.ts` | `place-order-load.ts` (loadCart, campaigns, mixed cart) |
| `core/cart/cart.ts` | `cart-room.ts` (stock, pre-order caps, cart limit) |
| `core/catalog/browse.ts` | `browse-filters.ts` (filter/sort SQL, facets) |
| `core/discovery/service.ts` | `recommendations.ts`, `overview.ts` |
| `core/inbox/conversations.ts` | `conversations-send.ts` (staffSend) |
| `core/order/drafts.ts` | `draft-list.ts` |
| `core/payments/attempts.ts` | `qr-attempts.ts` (retry and expired QR) |
| `core/shipping/shipments.ts` | `shipments-bulk.ts` |
| `core/notifications/deliver.ts` | `deliver-data.ts` |
| `core/marketing/automations.ts` | `automations-crud.ts` |
| `api/services/payments-setup.service.ts` | `payments-oauth.service.ts`, `payments-manual.service.ts` |
| `api/services/dashboard.service.ts` | `dashboard-buckets.ts` |
| `api/services/discount.service.ts` | `discount-usage.service.ts` |
| `api/services/order.service.ts` | `order-detail.service.ts` |
| `api/routers/orders.ts` | `order-list-filters.ts` |
| `api/mcp/action-catalogue.ts` | `action-areas.ts` |
| `db/schema.ts` | `shipping-schema.ts` (shipment … shipping_rate; added to `drizzle.config.ts`, no SQL change) |
| `money/src/index.ts` | `currencies.ts`, `format.ts`, `presentment.ts` (index re-exports) |
| `plugin-shopify-import/api-settings.ts` | `api-settings-read.ts`, `-shipping.ts`, `-stock.ts` |
| `plugin-shopify-import/settings-import.ts` | `settings-import-load.ts` |
| `plugins/src/types.ts` | `storefront-types.ts` |
| `storefront/lib/cart-actions.ts` | `payment-actions.ts` (retry, pay online, QR, confirm), `checkout-redirect.ts` |
| `storefront/lib/use-checkout-form.ts` | `checkout-form-input.ts`, `checkout-address-book.ts`, `payView` in `checkout-preview.ts` |
| `admin/components/products/form-state.ts` | `variant-reconcile.ts` |
| copy files (`customers`, `metaobjects`, `product-form`, `shopify-import`, storefront `checkout`) | one nested key each into its own `data/*.ts`, referenced from the parent object (Hindi pairs unchanged) |

Recorded sizes lowered: `dashboard.service.ts` 950, `marketing/automations.ts` 765.

## Allow-listed (with reasons)

- **router-magic-limits:** `products.ts: ids.max(50)`: the variant ids come back in one page of
  `limit <= 50`, and the combo editor chunks saved picks by the same 50.
- **router-permissions:** `reauth.ts` status / sendOtp / passkeyOptions / verify: step-up re-auth
  of the caller's own session, people only, no store data.
- **deploy-compose:** `THEME_SCREENSHOT_CHROMIUM` in `NOT_FOR_APPS`: the worker image sets it
  (Dockerfile ENV from the `THEME_SCREENSHOTS` build arg); an `x-app-env` entry would blank it.
- **hardcoded-colours:** `review-qr-card.tsx` (canvas-drawn printed card) and
  `campaign-look-card.tsx` (merchant-picked colours, `<input type="color">`). Stale
  `packing-slip.tsx` palette entry removed.
- **service-layer:** these follow the existing per-file patterns:
  - worker jobs: `home-cards`, `review-summaries`, `theme-screenshot`
  - plugin files on their own tables: reviews ×7, back-in-stock ×2, forms ×1, shopify-import ×3
  - `storefront/lib/market-catalog.ts`: `inStore` asks it for the catalog, so it opens its own
    `withStore`
  - `auth/step-up.ts`: Better Auth's own tables
  - `payment-actions.ts` replaces `cart-actions.ts`, whose code moved there.
- **no-orphans, test-only exports:**
  - `STEP_UP_REQUIRED`: kept for the A5 admin dialog
  - the AI answer table caps, `joinedName`, `comboSaving`, `orderPhoneForms`
  - the boost rank helpers, `usedUp`, the browse key helpers, `personalCodeFor`,
    `combineAdjustments`, `rateWebVital`, `couldNotStart`, `draftLineRate`
  - the reviews past-orders / QR / questions / widgets rules
  - the shopify-import plan and status helpers, and money's `presentmentLineMinor` /
    `presentmentCartMinor`.
