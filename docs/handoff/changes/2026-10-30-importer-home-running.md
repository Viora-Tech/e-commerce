# Importer home during a run (2026-10-30)

Local test: while an API import ran, `/apps/shopify-import` showed "Nothing imported yet" with
an empty "What's left" table and "Showing 0–0 of 0" in Import history.

## What was found

- No data was lost: the local DB still had both runs (the 24 Oct CSV import and the API run,
  which later ended "stopped unexpectedly" ~10 minutes after it started, i.e. its worker died).
- Both cards were stuck in their loading state, not empty: history swallowed every request error
  and stayed on skeletons ("Showing 0–0 of 0"), and "What's left" printed "Nothing imported yet"
  before its data had loaded.
- `shopifyImport.status` asked Shopify for 8 live counts inside the request's database
  transaction. During an import the worker drains the app's Shopify rate limit, so those counts
  are throttled and the request held a pooled connection for as long as that lasted.
- History polled with `setInterval`, so slow responses piled up more requests.
- "Last import" ignored CSV imports (it read API runs only).

## Changes

- `status.ts`: `activeRun` (newest queued/running run) → `ImportStatus.running`;
  `remainingStatus` fails stale runs first and, while a run is in flight, uses cached counts only;
  `shopifyCounts` has an 8 s budget and caches only a complete set; `lastImportAt` counts any real
  import, CSV included. `failStaleRuns` is exported from `service.ts`.
- Admin: "What's left" shows a "running" line with a link to the run, disables its import buttons
  and refreshes every 8 s while a run is in flight; no "Nothing imported yet" while loading.
  History polls one request at a time, shows an error instead of endless skeletons, and running
  rows show "N of M so far".
- Tests: `packages/plugin-shopify-import/test/home-running.test.ts`.
