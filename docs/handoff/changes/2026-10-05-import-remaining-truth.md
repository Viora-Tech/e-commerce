# Shopify importer: honest "what's left", bigger copies, Stop import (2026-10-05)

Branch `fix/import-remaining-truth`. Fixes #272, #273, #274. **Migration
`0089_shopify_import_stop`**: `shopify_import_run.stop_requested_at`, `stopped_by`, status
`cancelled` (check constraint).

- **What's left tells the truth (#272).** Never Done without Shopify's number: unknown reads
  "Not checked yet" + Run a preview. In Shopify falls back to a preview's copy
  (`snapshot.streams`) or the latest full import's totals (a started preview becomes the import,
  so its counts were lost: Files showed "—, 0, Done"). Missing also counts the import's
  `failed`, so imports with `source_id` NULL issues count. Product images: real imports now
  count `progress.products.images`; Here = `product_media` of imported products; legacy floor =
  here + "Image … was not copied" issues; the row always shows. Copy images / Copy files are an
  "Import remaining" whose filter now sees the record (`KeepTest(resource, id, item)`): products
  with an image source not copied (media mapping by URL) or fewer linked images; Files without a
  `files` mapping. Nothing is downloaded twice.
- **Bigger copies (#273).** `src/limits.ts`: images 50 MB, videos 1 GB (streamed). Byte budget
  (96 MB, `createByteBudget`) for whole-read copies; deadlines pause while waiting. Unknown
  types sniffed from the first bytes (`media-streams.ts`), so videos sent as octet-stream stream.
- **Worker crash.** Bun's web-stream piping threw "undefined is not a function" at the end of
  the Files step (worker exit 1 twice). No `pipeThrough`/`.pipe` on copy or snapshot paths now;
  the worker logs uncaught exceptions/rejections instead of exiting.
- **Stop import (#274).** Button + confirm on the run page; API `shopifyImport.stop` (Apps:
  manage). Queued: cancelled, BullMQ job removed (`removeAppJob`). Running: polled every 3 s,
  run signal aborts readers and copies, ends `cancelled`; not acknowledged in 60 s → the next
  read marks it cancelled; a late job does nothing. Runs list shows Stopped.
- **Problem groups** count records to retry (distinct keys), plus "77 images can be retried with
  the 23 records they belong to".
- **Redirects "skipped 29"**: they were already here with the same target (a re-run). Now counted
  as updated; a hand-made redirect kept is noted (`redirect_manual`), a home-page/empty path is
  an issue (`redirect_invalid`).

Tests: `test/remaining-truth.test.ts`, `test/stop-import.test.ts`, `media.test.ts` (30 MB image,
50 MB refusal, 120 MB video streamed, sniffed video, byte budget, video path without piping),
`status.test.ts` (records vs problems), core redirects, api permissions (stop needs Apps: manage).
Docs: developer "Shopify importer", merchant "Import from Shopify".
