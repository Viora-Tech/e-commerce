# Faster image processing (2026-10-11)

A 2,150-image Shopify import took ~25 s per image on a 2-vCPU box (2 jobs at once, 1 per store).

- `MEDIA_PROCESS_CONCURRENCY` / `MEDIA_PROCESS_PER_STORE` (env, optional; defaults 3 and 3 from `QUEUE_LIMITS.mediaProcess`). Per-store cap is clamped to the concurrency. `apps/worker/src/media-limits.ts`.
- Job data gets `bulk?: boolean`. `ctx.processMedia(id, { bulk: true })`; the Shopify import plugin sets it. Worker maps it to `processImage({ profile: 'bulk' })`.
- Bulk profile: AVIF effort 2, widths encoded sequentially. Interactive uploads unchanged (effort 4, parallel widths).
- `tuneImagePipeline` at worker start: sharp threads = cpus / concurrency, libvips cache 100 MB.
- Keys added to `deploy/docker-compose.prod.yml` x-app-env, `deploy/env.production.example`, `.env.example`. Nothing to set for the new defaults; raise them on a bigger box.
- Jobs queued before this change have no `bulk` flag; the worker also picks the bulk profile when the store has 25+ images still `processing` (`BULK_BACKLOG`), so the existing backlog speeds up too.
