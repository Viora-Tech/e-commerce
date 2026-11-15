# Page pass 10: Analytics (overview, reports home, a report, AI answer, live view, visitors)

Audit section 7, row 10. Visual and state consistency only: every figure, range, comparison,
export and save is as before.

## Already done before this pass (checked, left alone)

- Wave 1/2: every analytics card is a DataCard (ChartCard is built on it, `text-card-title`);
  every page is on PageBody (no hand-copied shell strings left); the KPI strip is StatStrip on
  `text-caption` / `text-stat`, and its `loading` draws grey bars in each cell.

## Loading and failures

- **Overview and a report: a failed read for new dates** shows "Could not load analytics for
  these dates" / "Could not load this report for these dates" with Try again, in place of the
  figures (was: no catch, the old range's numbers stayed under the new range). A role without
  access sees "You do not have access". New `range-failed.tsx`, copy + Hindi.
- **While new dates load**: the KPI strip draws its skeleton (as before); the sales chart draws a
  skeleton in its frame and its subtitle dims (new ChartCard `loading`); the cards under it dim.
  On a report, the profit card, chart and details dim (was: no indicator at all).
- Going back to the first range while a read was running no longer leaves the page loading.
- **Visitors section**: its loading picture is the section's own shape (five KPI cells, the chart
  card, the list cards) instead of one grey block; when Umami cannot be reached the state has a
  red tile and Try again next to "Check Umami settings". The not-installed / not-connected /
  error state is `EmptyState variant="page"` (was a raw Card around a section EmptyState).
- **Live view**: a failed 15-second poll keeps the last figures (was an unhandled rejection).
- **AI answer**: shows the report skeleton while the handed-over answer is read (was blank,
  then popped in).

## Skeletons that match each route

`analytics/loading.tsx` (the overview's, on PageBody with the real title and chart title) used to
serve every analytics route. New loaders: `live/` (full-height globe area, glass header, two
floating cards), `reports/` (reports home: title, ask box, saved cards, template tiles),
`reports/[slug]/` (report: back link, two buttons, controls row, chart, details),
`reports/answer/` (one button and the snapshot note), `reports/query/` (editor and 18rem side panel).

## Cards, banners, empties, tables

- Report page: the controls card (What I understood, date range, compare, Bar/Line) is a plain row
  under the header like the overview's range row, not a raw Card.
- AI answer: the snapshot note is an `Alert tone="info"` (was a raw Card); the "no answer" line
  is `EmptyState variant="dashed"`.
- Reports home: the "no saved reports" line is `EmptyState variant="dashed"`; the extra wrapper
  around the header and ask box went (same 1.5rem gap).
- Funnel card with no traffic: the help line is `EmptyState variant="inline"`.
- Report details table (report, AI answer, query result) is SimpleTable `compact` (was a raw Table),
  same columns, alignment and totals row.
- Breakdown, funnel, visitor list and live feed rows: `text-kit-body` / `text-kit-mini` are now
  `text-body` / `text-period` (same sizes, the standard line heights).

## Shared files touched

- `components/layout/chart-card.tsx`: optional `loading` prop (also used by
  `sales-channels/social-channel-page.tsx`, which does not pass it, so it is unchanged).

## Left alone

- Live view's floating glass cards stay raw `Card` with the glass surface (allowed in the
  no-restyle guard's warn list).
- Reports home ask-box conversation panel (assistant turns) keeps its hand-made bordered panel.
- Query result: the chart view still nests ReportChart's DataCard inside the result DataCard;
  fixing it means a bare mode for ReportChart, out of this pass.
- KitProgress and KitListRow stay (live kit parts).
