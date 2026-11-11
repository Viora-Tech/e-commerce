# Amazon SES: every call has a deadline (#1554)

- New `packages/notifications-ses/src/client.ts` `makeSesClient`: the SES v2 client with
  `connectionTimeout` 5 s, `requestTimeout` 15 s and `throwOnRequestTimeout` (same pattern as
  `@commerce/storage-s3-compat`). `SesChannel` and `SesIdentityProvider` both use it.
- A timed-out send comes back as `{ ok: false, retryable: true }` (the SDK names it
  `TimeoutError`, already in the retryable list).
- Test: `test/timeout.test.ts` (a local endpoint that never answers; no AWS call).
- Found by the Phase 1b group 1 audit: `docs/audits/2026-11-11-apps-group-1.md`.
