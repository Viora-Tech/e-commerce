# Media files carry a one-year Cache-Control

Files on cdn.koomerce.app were stored with no `Cache-Control`, so browsers revalidated or refetched
every image on every page and Cloudflare reported `cf-cache-status: DYNAMIC`.

- `@commerce/storage`: `PutInput`/`PutStreamInput` take an optional `cacheControl`;
  `MEDIA_CACHE_CONTROL` (`public, max-age=31536000, immutable`) and `cacheControlFor` live in
  `keys.ts`. The S3/R2 provider (`storage-s3-compat`) sends it on `put` and `putStream`.
- The media pipeline (`packages/core/src/media/pipeline.ts`) marks the cleaned master and every
  `-w<width>` AVIF/WebP variant with it, so all three worker paths (process, rehost, reprocess) write
  it. A video under a media key gets it by default (stored as it came, never rewritten).
- Deliberately not cached: an image's first write (browser presigned upload, review photo, import
  copy) is the unprocessed original with EXIF/GPS; it gets the header only when the pipeline
  rewrites it. Presigned browser uploads are unchanged (no new signed header, no CORS change).
  Invoices, labels, exports and theme thumbnails are untouched.
- Existing objects: `bun scripts/media-cache-headers.ts` (dry run) then `--apply`, with the R2_* (or
  S3_*) env, copies each media object onto itself with the header. Idempotent; skips fresh
  non-variant images that may still be unprocessed. Purge cdn.koomerce.app afterwards.
- Cloudflare: `cf-cache-status: DYNAMIC` on a `.png` means a rule on cdn.koomerce.app bypasses the
  cache; the header alone fixes browser caching, the edge also needs that rule changed (owner).
