# Shopify import run page redesign (2026-10-11)

UI only, same data and API. `apps/admin/src/components/apps/shopify-import/`:

- `run-header-card.tsx`: state (Waiting / Previewing / Ready to import / Importing / Done / Failed / Stopped) with icon, started and finished times, message, and the actions (`run-actions.tsx`: Run preview again, Import now, Retry, Run again, View store).
- `run-stat-tiles.tsx`: To bring over, New, Updated, Skipped, Failed; zero tiles muted, Failed red above zero.
- `run-type-grid.tsx` + `run-type-card.tsx`: type cards replace the table; bar only while running, green check when a type is done, chips only for non-zero outcomes; empty types fold into one "Nothing to bring" line.
- `run-left-card.tsx` + `run-left-group.tsx`: collapsible group per type with a count badge, 3 rows then "Show all".
- `run-samples-card.tsx` + `run-sample-row.tsx`: tabs per type, thumbnail, detail chips, status chips.
- `run-issues-card.tsx` + `run-problem-groups.tsx`: warning card, collapsible groups with severity icons, "Show every record" button; zero problems is one green line.
- Copy in `data/shopify-import-run.ts` (Hindi `data/hi/shopify-import-run.ts`); icons per type in `run-resource-icons.ts`.
- `PreviewSample` gained an optional `image`; the product preview fills it with the first image.
- Removed `run-progress-card.tsx` (replaced by the type grid).
