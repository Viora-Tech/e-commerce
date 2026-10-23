# Growth charts: never vanish, Shopify-parity over-time graphs, local demo seed

Branch `ui/growth-charts`. No migration, no new dependencies.

The owner saw "no graphs in the growth routes": with 0 `marketing_session` rows the Growth charts
swapped themselves for a one-line message.

## What changed

- **`components/growth/growth-trend-chart.tsx`**: the Growth line chart (recharts
  `ComposedChart` in `ChartContainer`): axes, a soft grid, the current period as a filled line
  and the period before dashed. When every point is 0 it still draws the frame and a flat zero
  line (y axis pinned to `[0, 1]` with a single `0` tick) with a muted note over it, like
  Shopify's empty charts. The shared `ChartCard` and `StatTile` are untouched (`StatTile`'s
  spark already draws a flat line for zeros).
- **Overview** (`growth-overview.tsx`): adds the tiles with sparklines (`GrowthKpiStrip`),
  "Sessions over time" against the period before (`overview/sessions-card.tsx`) beside "Sales
  attributed to marketing" (now always a chart with axes), and "Top channels"
  (`overview/channels-chart-card.tsx`, sales or sessions per channel as bars; zero bars for the
  usual channels when empty). "Sessions by traffic type" shows an empty track with its note.
- **Attribution** (`attribution-page.tsx`): the full-width "Sales attributed to marketing"
  (daily / weekly, previous period dashed) replaces the shared `ChartCard`, plus sessions over
  time and the by-channel chart.
- **Campaign detail** (`campaigns/campaign-performance.tsx` → `campaign-trend-card.tsx`):
  "Results over time", sessions / orders / sales per day since sending began (up to 30 days).
- **Links** (`links/links-trend-card.tsx`): clicks / orders / revenue per day, last 30 days.
- **Autopilot**: "Sales attributed to marketing" for the last 30 days in the right column.
- Copy in `data/growth-home.ts`, `data/growth-report.ts`, `data/growth.ts` with Hindi overlays;
  the unused `growthOverviewContent.salesOverTime` group is gone.

## API

- `marketingOverview`: the `sessions` KPI now carries `previousSeries` (the period before, day
  by day).
- `campaignReport` returns `daily: CampaignDay[]` (exported from `@commerce/api`).
- New `shortLinks.trend` (`can(permissions.MARKETING_READ)`, RLS-scoped through the store
  transaction): `shortLinkTrend` in `short-links.service.ts`.

## Local demo seed

`bun run db:seed:demo:marketing` (`packages/db/src/seed-demo-marketing.ts`): about 60 days of
`marketing_session` rows across Google (organic and ads), Bing, Instagram (organic and paid),
Facebook, WhatsApp, email and direct, with a weekly rhythm and a rise. WhatsApp and email visits
carry an existing campaign's id and `utm_campaign` (or `festive-drop` / `restock-alert` /
`weekend-deals` when the store has no campaigns). About 70% of orders in the window with no
attribution get the attribution of a session from the three days before (`order.attribution`,
what every Growth query reads). Rows are tagged (`demo-mkt-` visitor ids, `demo: true` in the
order attribution), so a rerun replaces them and `--clean` removes them; real attribution is
never touched. Refuses `NODE_ENV=production` and any non-localhost `DATABASE_URL` /
`DATABASE_URL_OWNER`.
