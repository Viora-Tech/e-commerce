# Shopify import no longer hangs on image/file copies (2026-10-05)

Test server, R2, full API import: the run sat in the products step forever. Worker network ~0,
CPU idle, `progress` stayed `{}`, `updated_at` ticked every minute (so the stale-run check never
fired), and the log had 14x "An error was encountered in a non-retryable streaming request".
Issue #266.

- **Root cause.** PR #249 streamed copies: `S3CompatProvider.putStream` sent
  `Readable.fromWeb(body)` with `ContentLength` taken from the CDN's `content-length`, through a
  byte counter that errors when the length differs. `fetch` decompresses gzip/br and keeps the
  compressed length, and `safeFetch`'s 30 s timeout also covers the body, so the stream often
  errored part way. `@smithy/node-http-handler` sends a stream with `body.pipe(req)`, which does
  not forward the error: the request stays open waiting for bytes, and with no
  `requestTimeout` it never ends (sometimes R2 dropped it: the 14 warnings). Hung copies held all
  16 media slots; the products step waits for a whole batch's copies before counting anything,
  and the heartbeat kept `updated_at` fresh. Reproduced in
  `packages/storage-s3-compat/test/no-hang.test.ts` against a local HTTP server.
- **Sizes.** `putStream` has no size any more and R2/S3 implement it with `@aws-sdk/lib-storage`
  `Upload` (8 MB parts, 2 in flight; a body under one part is one exact PUT). Images and unknown
  types are read whole and stored with `put` of their exact length. `content-length` is only an
  early "too large" hint, ignored when `content-encoding` is set. Only videos stream (4 at once).
- **Timeouts.** Each copy attempt: 60 s overall (10 min once a video streams) and 30 s idle,
  aborting one signal that ends the download (`safeFetch` now takes `signal`) and the write
  (`put`/`putStream` take `signal`), raced so the slot is always freed. S3 client:
  `connectionTimeout` 10 s, `requestTimeout` 5 min, `throwOnRequestTimeout`
  (`S3_COMPAT_TIMEOUTS`). The media row is written only after the object is stored.
- **Retries.** Timeouts, network errors, 408/429/5xx retried twice (1 s, 3 s); refusals
  (`BlockedUrlError`, now exported by `@commerce/core/safe-fetch`, other 4xx, too large,
  unsupported) not. The final error ("timed out: no data for 30 s (tried 3 times)") becomes the
  usual issue with the record's key, so "Retry the N that were missed" picks it up.
- **Watchdog.** `Reporter.lastActivity` moves on records, issues, copy bytes and Shopify answers.
  The heartbeat only touches the row while something moved; after `STUCK_MS` (10 min) of nothing
  the run is stopped (copies aborted, reporter closed) and failed with "The import stopped
  moving…". `RUN_STALE_MS` in service.ts stays as the backstop for a dead worker.
- **Progress.** `progress.<resource>.copied` / `notCopied` move per copy, and each batch's total
  is flushed before its copies start.
- New dependency `@aws-sdk/lib-storage` (Apache-2.0, same AWS SDK as `client-s3`,
  locked at 3.1140.0 to match `client-s3`). No migration (latest is still 0088).

Tests: `storage-s3-compat/test/no-hang.test.ts` (exact length on PUT, broken body rejects,
signal aborts, unanswered bucket times out); `plugin-shopify-import/test/media.test.ts` (gzip
body with a wrong content-length stored with its real length, image and video; stalled body
times out after 3 tries and frees the slot; silent source hits the overall deadline; 503
retried, 404 not; run stop aborts copies); `test/stuck-copies.test.ts` (a CSV import with one
never-ending image completes with an issue that carries the product key; a run where nothing
moves is failed by the watchdog). Docs: developer `building/shopify-import.mdx`, merchant
`selling/import-from-shopify.mdx`.
