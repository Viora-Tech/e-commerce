# CI guardrail landmines unblocked (dev + main)

Two guardrail sweeps/tests went red after PRs that merged while the CI gate
was paused reached `dev` (and then `main` via releases #821/#837). Neither is
a runtime bug — both are hygiene checks that classify newly-added symbols.

- **`no-orphans`**: `balanceOf` in `packages/api/src/services/order-fulfil.service.ts`
  (added with the refund-balance fix, #836) is exported but used only inside
  its own file by `orderBalance`. Added to the existing allow-list entry for
  that file, alongside `customerName`.
- **`storefront-cache`**: `courier_order` (added with the courier push work) is
  a new `store_id` table in neither cache list. Classified **ADMIN** (exempt):
  fulfilment/operational data — an order pushed to a courier provider (external
  ids + status) — never rendered on a cached storefront page, same bucket as
  `courier_wallet_balance` / `shipment_manifest` / `shipment_pickup`.

Follow-up: `balanceOf` encodes subtle refund logic (a refund never puts the
customer back in debt) and deserves its own unit test, like `gatewayPaidTooLittle`.
