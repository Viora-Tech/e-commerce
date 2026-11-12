# Admin: batch the browser's API calls (12 Nov 2026)

- `createApiClient(url, headers, interceptors, { batch: true })` adds oRPC's `BatchLinkPlugin`:
  calls made in the same tick go as one `POST /api/rpc/__batch__` (at most 10), each with its own
  result and error. `ai.assistant` (a stream) is never batched.
- The admin's RPC route runs `BatchHandlerPlugin` and gives each HTTP request one
  `createRequestMemo()`, so every call in a batch shares one session and membership lookup
  (permissions are still read per call).
- `scripts/perf/admin-pages.ts`: `PERF_MIN_FREE_MB` lowers the low-memory guard for `next start` runs.
- Measured on production builds (perf DB: 504 products, 2k customers, 5k orders), fastest of 3:
  Live view ready 1,193 → 474 ms; product page 198 → 148 DB statements; other pages 4–11% fewer
  statements, times within noise. Local Postgres makes round trips nearly free; production pays a
  real network wait per HTTP request and per statement.
- Tests: `packages/api/test/client-batch.test.ts`.
