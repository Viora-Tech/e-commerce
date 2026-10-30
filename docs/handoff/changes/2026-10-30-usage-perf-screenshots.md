# 2026-10-30 — App activity, file and menu usage, Web performance, theme screenshots

Owner audit items #145, #90, #92, #124, #123.

- **Apps "Last activity" (#145).** `storeAppSummaries` now shows the newer of recorded activity and
  activity read from what the app keeps: a storage app's newest file (`media.provider`), or the
  manifest's new optional `lastUsed(tx, storeId)` (Reviews: newest review, Forms: newest message,
  Back in stock: newest signup). Umami records "Read visits for Analytics" whenever the Analytics
  page reads it and "Connected to …" on Test.
- **Files "Used in" (#90).** `packages/core/src/media/references.ts`: the library count and the file
  page's list cover products (gallery, variant image, variant gallery), collections, blog posts
  (image or in the body), pages (in the body), reviews (`review_media`) and themes (settings,
  templates, an imported theme's JSON files; themes keep image addresses, so matched by URL). The
  "Used" filter and the Storage page's largest files use the same count. Copy: "Used in N places".
- **Menus "Used in" (#92).** `menuThemePlacements` (core `navigation/theme-uses.ts`, route
  `navigation.themePlacements`) reads the live theme's templates and JSON files for menu-picking
  settings (`menu`, `*_menu`, `link_list`…) naming a menu handle, placed by header / footer group or
  "Theme sections". The admin unions it with the Navigation setting.
- **Web performance (#124).** New `web_vital` table (migration 0196, anonymous: metric, value,
  device class, path). The storefront reports LCP, INP and CLS with Next's `useReportWebVitals`
  (`web-vitals-beacon.tsx`, not in theme previews or iframes) to `/api/vitals` (same-origin,
  rate-limited, bots skipped). `themes.webPerformance` gives the p75 of 28 days with Google's bands
  and page loads by device; the Themes page shows the strip, "Collecting data" under 20 readings.
  Follow-up: prune old `web_vital` rows in the retention job.
- **Theme screenshots (#123).** Worker queue `{themes}-screenshot` (`apps/worker/src/theme-screenshot.ts`):
  Playwright (`playwright-core`) opens the theme's signed preview link at 1440 × 1080, saves a
  960-wide webp as the theme thumbnail (same key as Customize's capture). Queued 20 s after
  Publish, Customize Save, Edit code Publish, and when the Themes page finds the live theme with no
  picture. **Deploy:** the production worker image has no browser by default; build it with
  `--build-arg THEME_SCREENSHOTS=1` (Alpine Chromium) and raise the worker's `mem_limit` to at
  least 768m. Without that the jobs end at once and the placeholder stays. Locally, run
  `bunx playwright install chromium` once.
