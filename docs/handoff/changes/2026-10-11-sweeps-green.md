# Guardrail sweeps green again (2026-10-11)

`bun run test:sweeps` had 16 failing tests after ~100 merged PRs. Each was fixed at its cause; no behaviour changes, no migrations.

- deploy-compose: `UMAMI_TRUSTED_ORIGINS` passed to the apps in `deploy/docker-compose.prod.yml` and documented in `deploy/env.production.example`.
- turbo-cache-graph: `@commerce/plugin-umami#build` added to `//#plugin-graph`.
- domain-errors: `UmamiError` extends `CommerceError` (same `code`).
- server-only-guard: `import 'server-only'` in storefront `lib/parcels.ts` and `lib/umami.ts`.
- money-format / date-format: `po-sheet.ts` uses `formatNumber` and `formatInZone`.
- duplicate-helpers: team-grid's local `initials` renamed `personInitials` (it differs: empty for non-text names).
- source-of-truth-header: headers added/normalised to `/** SOURCE OF TRUTH: ...`.
- file-size: splits, same exports. db: `theme-schema.ts`; admin data: `customize-add-section.ts`, `customize-inspector.ts`, `order-cards.ts` (+ Hindi `hi/order-cards.ts`); api: `theme-templates.ts`, `theme-helpers.ts`, `order-drafts.ts`, `shipments-operations.service.ts`; core: `product-rows.ts`, `registration-views.ts`; notifications: `content-parts.ts`; gst plugin: `credit-notes.ts`, `next-number.ts`.
- Allow-lists: stale rows removed (admin-routes, no-orphans, file-size); justified rows added (hardcoded-colours, router-magic-limits, service-layer, no-orphans).

Follow-ups for the owner: the new no-orphans rows are exports with no importer today (e.g. `umamiPlugin`, `PurchaseOrderPdf`, `validateMerchantUserInfo`): wire up or delete.
