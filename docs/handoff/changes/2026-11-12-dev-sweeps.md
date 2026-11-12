# Sweeps green on dev again

Merging the 12 Nov batches left 4 guardrail sweeps failing on dev:
- **file-size**: `packages/db/src/resolve-store.ts` reached 507 lines. The worker's "which stores need
  this job" lookups (`storesWithRetentionDue` … `storesWithPendingGatewayRefunds`) moved to
  `packages/db/src/store-sweeps.ts`, re-exported from `resolve-store.ts` so imports don't change.
- **no-orphans**: `syncRefundedStatus` is now module-private; `shopperPayment` is allow-listed (its test).
- **service-layer**: `apps/worker/src/refund-sync.ts` allow-listed (it only lists stores via a db function).
- **source-of-truth-header**: headers fixed/added on the refund-settle/-sync files and two tests.
All 29 sweep files pass; db and core typecheck clean.
