# Storefront memory report

- The storefront ran out of heap (~500 MB) after about 25 h on 13 Nov 2026, with nothing in the
  logs before it. It now logs `storefront memory` every 10 minutes (`lib/memory-report.ts`,
  started in `instrumentation.ts`): RSS, heap used / total / limit, external, array buffers,
  heap share, and the render cache's entries, charged size and in-flight loads. Past 75 % of
  the heap limit the line is a warning.
- Read it from the Dokploy storefront logs (filter `storefront memory`). A heap that keeps
  climbing while `renderCache.budgetMb` sits at its cap (48) means a leak outside the cache.
