# media:rehost and media:reprocess take `--concurrency`

Both scripts processed rows one at a time: in production `media:rehost` took ~25 s an image on a
2-vCPU server (1,955 images, 8+ hours) while using one core. They now take `--concurrency <n>`
(default 2, clamped 1..8, under the DB pool's `max: 10`) and run that many rows at once.

- `apps/worker/src/media-concurrency.ts`: `parseConcurrency` and a small `forEachLimit` pool
  (the importer's `mapLimit` isn't exported from its package), with a unit test.
- `media-rehost.ts`: rows go through the pool, each in its own `withStore` transaction. The
  whole row is inside the try now (the "already in the bucket" branch could previously crash the
  run). Progress every 25, summary line, description rewrite after all rows: unchanged.
- `media-reprocess.ts`: rows of each `LIMIT` batch go through the pool; a failure to mark a row
  `failed` is logged instead of stopping the run.
- `processImage` (sharp) is CPU-bound: set `--concurrency` to about the server's cores.
- Docs: developer docs "Media pipeline" → Backfill, plus a "Rehost after a bucket move" section.
