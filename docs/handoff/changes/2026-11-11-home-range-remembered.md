# Admin home remembers the picked date range (#1438)

- The Home sales card saves its range and comparison in the `koo_home_range` cookie
  (`preset.from.to.compare`, one year) whenever the member changes either.
- `app/(admin)/page.tsx` reads it and renders that range first, so there is no flash of Today.
- A preset (Last 7 days, This month…) is worked out again for today, so it keeps rolling; a
  custom range keeps its dates (capped at today). A broken cookie falls back to Today.
- Per browser, not per store. Helpers and tests: `apps/admin/src/lib/home-range.ts`, `home-range.test.ts`.
