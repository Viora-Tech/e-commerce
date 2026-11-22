# Two stale tests fixed before the 22 Nov release

**What:** the full run on dev had two tests that broke long ago on purpose-made changes, not bugs:
- `packages/queue/src/fair.test.ts`: `mediaProcess` has been one-at-a-time (`concurrency: 1,
  perStore: 1`) since #1471, so "store cap below concurrency" can't hold for it. The test now
  allows `perStore === 1` when the queue has a single slot.
- `packages/ui/src/globe/webgl/globe-renderer.test.ts`: dot sizes changed in #1449
  (`MARKER_SIZE` 0.022, `NEWEST_SIZE` 0.034); the test still had the old numbers.

Other failures in that run (`store-data`, storefront proxy tests, affiliates GST) pass when run
alone; they were load timeouts with every suite running at once on the low-memory machine.
