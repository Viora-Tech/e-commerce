# Shopify import reuses the preview; batched writes; no stuck runs (2026-10-05)

Branch `feat/shopify-import-reuse-preview`. **Migration `0087_shopify_import_snapshot`**:
`shopify_import_run.snapshot`, `snapshot_taken_at`, `snapshot_use` (+ partial index) and the
SECURITY DEFINER `stores_with_stale_import_snapshots(cutoff)`.

- **Preview → Import now reads the preview's copy.** A preview stores what it read (gzipped
  JSONL per resource, private storage). Import now within 24 h reads it and asks Shopify only
  for `updated_at:>'…'` changes, merged by Shopify id; products' stock is read fresh. Covered:
  products, collections, customers, orders, pages, articles, files. Menus, redirects,
  metaobjects, metafields, discounts and gift cards are read in full. Copies are deleted when
  the import completes, and after 7 days (start of every run + worker job
  `{imports}-snapshot-cleanup`, hourly). Code: `packages/plugin-shopify-import/src/snapshot.ts`.
- **Batched writes.** Products (25), customers (200), orders (100) per transaction, multi-row
  inserts and mapping upserts; a failing batch rolls back and retries record by record
  (`writeBatch` in `runtime.ts`).
- **Memory.** Bulk JSONL is streamed record by record (`streamBulkRoots`), snapshots are
  written and read in batches; no resource is held whole (the Waimers import OOM-killed the
  worker at a 384 MB cap).
- **Stuck runs.** New optional `jobFailed` on the plugin manifest, run by the app-jobs worker
  when a job fails for good (last attempt or stalled out): the importer marks the run failed.
  Backstop: a `running` run silent for 10 min is failed on the next read. Try again now queues
  a fresh BullMQ job id per start (`runJobKey`); the old fixed id was ignored while the failed
  job was kept, leaving the run queued forever.
- **Before you import.** `preflightChecks` (`src/preflight.ts`, API `shopifyImport.preflight`):
  storage on the local fallback in production (warn, link to `/content/files/storage`), missing
  Shopify scope (block that resource only), connection check failed (block), no
  `read_all_orders` (warn), orders/collections/discounts/extra fields without products, gift
  cards without customers (warn). Card on the connect page and on a finished preview. Every
  real import first writes+deletes a test file; if storage refuses, ONE issue and all media and
  files are skipped (left reason `storage_unwritable`).
- **Retry only what was missed.** Migration 0087 also adds `shopify_import_issue.source_id` +
  `kind` (`record`/`media`/`file`) and `shopify_import_run.retry_of`. "Retry the N that were
  missed" (`createRetryRun`, API `retryRun`) imports only those keys: from the kept snapshot
  (+ changes) while fresh, else by `id:` search; failed images re-copy only those images.
  "Import everything again" is the old full re-run. `run.ts` split: reading/writing per
  resource is now `src/read-write.ts`.
- The worker now depends on `@commerce/plugin-shopify-import` (client constants only).
- Docs: developer docs "Shopify importer" (snapshot, memory, batched writes, dead worker),
  merchant guide "Import from Shopify".
