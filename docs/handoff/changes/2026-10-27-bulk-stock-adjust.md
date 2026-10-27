# 2026-10-27 — Bulk stock: "Set to" or "Adjust by"

**Owner ask:** the bulk stock dialog on Stock → Inventory only set an absolute count, so stock could not be lowered by an amount in bulk.

## What changed

- **Dialog** (`apps/admin/src/components/inventory/inventory-bulk-dialog.tsx`): a "Set to / Adjust by" toggle at the top. "Set to" keeps the absolute on hand count (no negatives). "Adjust by" takes a +/− delta per SKU at the chosen location. The page keeps the chosen mode (`onModeChange`). Copy in `data/inventory.ts` plus the Hindi overlay.
- **Core** (`packages/core/src/inventory/levels.ts`): `bulkAdjustStock` dedupes the ids, checks the variants belong to the store, then for a negative delta reads every SKU's on hand first and refuses the whole batch with `Stock would go below zero for A, B …` (up to 5 names, then "and N more"). Variants that do not track inventory are never refused. After that it calls `adjustStock` per SKU, so each one gets a stock-history row with reason and note, and the low/out-of-stock and restock events.
- **Pure helpers** (`packages/core/src/inventory/stock.ts`): `belowZeroAfter`, `nameList`.
- **API** (`inventory.bulkEdit`): `mode: 'adjust'` goes through `bulkAdjustStock`; `set` is unchanged.

## Tests

- `packages/core/src/inventory/stock.test.ts`: `belowZeroAfter`, `nameList`.
- `packages/api/test/inventory.test.ts`: a refused −4 names `BULK-B` and leaves both counts as they were; −2 applies to both and logs the history row; +5 applies.

## Note

The core vitest global setup failed on the shared local test DB (`platform_account` already exists, from a different migration state). That is unrelated to this change. The pure stock tests pass when run without the DB setup.
