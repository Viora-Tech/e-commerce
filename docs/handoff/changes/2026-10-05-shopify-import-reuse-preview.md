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
- The worker now depends on `@commerce/plugin-shopify-import` (client constants only).
- Docs: developer docs "Shopify importer" (snapshot, memory, batched writes, dead worker),
  merchant guide "Import from Shopify".
