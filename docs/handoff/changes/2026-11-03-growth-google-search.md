# Growth: a Google Search card from Search Console (#1022)

The Growth overview showed Google only as on-site sessions. It now has a **Google Search** card
under Performance: Search Console's clicks, views, click rate and average position for the
stored 28 days against the 28 before, and the top 5 searches, with links into the app.

- `marketing.searchSummary` (MARKETING_READ, so a marketer without online-store access sees it):
  `searchConsoleSummary` in search-console-report.service.ts, reading only the stored `total` and
  `query` rows. Same setup states as the app's report (`not-installed`, `not-connected`,
  `no-property`, `pending`); the card shows the missing step with a button.
- The page's range picker does not apply: Google's numbers are fixed 28-day windows about three
  days behind, and the card says so. A live query for the picked range would need a call to
  Google per page view; left out on purpose.
- `searchConsoleEnv` is exported from routers/search-console.ts for the marketing router.
- Copy in `data/growth-home.ts` + Hindi; tiles and list reuse the app's own copy. MCP action docs
  regenerated; merchant guide Growth → Overview updated. Test: packages/api/test/growth-google-search.test.ts.
