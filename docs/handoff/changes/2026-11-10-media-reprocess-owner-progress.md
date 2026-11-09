# media:reprocess works in production, faster, with progress (#1424)

- **Store lookup** uses the owner login (`DATABASE_URL_OWNER`). Production no longer says "nothing to reprocess" because of row-level security.
- **Fast path:** a photo that only lacks its own-width copy gets just that copy (`encodeVariantWidth` in `packages/core/src/media/pipeline.ts`), not every width again.
- **Order and progress:** most-used photos first, a count up front and a progress line every 10 rows. A failing row is tried once per run.
- **Run on the worker:** `cd /repo/apps/worker && bun run src/media-reprocess.ts --store <slug> --own-size --concurrency 1`.
