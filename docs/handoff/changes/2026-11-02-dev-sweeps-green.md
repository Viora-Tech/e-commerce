# Guardrail sweeps green on dev

`dev` CI had stopped at lint, so 7 sweeps went red unseen across recent merges. All 26 pass again.

- **mcp-action-docs:** regenerated (`bun scripts/gen-mcp-action-docs.ts`) for the email template
  and draft reserve actions.
- **admin-routes:** `shipments/ndr-tab.tsx` links with `routes.orders.detail()`; its allow-list
  row is gone.
- **date-format:** `notifications/src/samples.ts` formats preview dates with `formatInZone`
  (`@commerce/dates`, now a dev dependency of notifications like `@commerce/config`).
- **site-config:** the "by Koomerce" (inventory, product form, en and hi) and "Powered by Koomerce"
  (email layout) strings read `siteConfig.brand.name`.
- **source-of-truth-header:** headers on `order/draft-reserve.ts`, `order/payment-terms.ts` and
  the `payment-terms` / `staff-hold` tests.
- **no-orphans:** five in-file-only exports are no longer exported; the unused
  `EMAIL_STARTER_IDS` and `emailStarter` are deleted; `priceRange`, `DraftHoldInPast` and
  `OrderNotHoldable` (used by tests) are allow-listed with reasons, and so is `ledgerCsvCell` (#1036).
- **file-size:** allow-listed, not split: six new modules just over 500 lines, and the recorded
  sizes of `liquid-theme.ts` (560 → 669) and `db/src/schema.ts` (2549 → 2630) raised. Each is a
  "split when it next changes" candidate.
