# GST invoices Queue page rebuilt to Figma 928:10728

Branch `feat/gst-queue-page`. No migration.

- **Page** (`apps/admin/src/components/apps/gst-invoices/queue-page.tsx`): four stat tiles
  (`queue-stats.tsx`), All / Ready / Needs fixing chips, table Order · Customer · GSTIN ·
  Taxable · GST · Status with Issue or Fix per row (`queue-row.tsx`), header "Issue N invoices"
  (the ticked ready rows, else every ready row). Issue still goes through `review-panel.tsx`, which
  confirms invoice dates and previews numbers before anything is numbered.
- **Kept from the old page**, now in the "…" menu beside Issue (`queue-more-menu.tsx`): add orders
  by number, filter by due date (an active range shows as a removable chip), remove ticked rows
  from the queue. Row checkboxes stay so Issue and Remove can work on a selection. The GST number
  picker stays in the header (hidden when the store has one GSTIN).
- **Export GSTR-1** (`gst-export-button.tsx`), the app's `HeaderAction` in the app bar: last
  month's or this month's GSTR-1 JSON for the main GSTIN (reuses `returns.gstr1Json`), plus a
  link to the Returns tab for everything else.
- **Back end** (`packages/plugin-gst-invoices/src/queue-status.ts`): `queueRows` adds each draft's
  status from today's product data (HSN missing → Fix opens the product; rule 46 buyer details
  missing → Fix opens the order; Ready · Export; Ready · B2B when the buyer has a GSTIN; Ready);
  `queueStats` gives issued this month (cancelled excluded) and taxable value, credit notes and
  value, and the next domestic tax invoice number with its 1 April reset (null when the series
  never resets). Router: `gstInvoices.queue.list` now returns `taxablePaise`, `gstPaise`,
  `buyerPlace`, `status`, `fix`; new `gstInvoices.queue.stats` (orders.read).
- Copy: `data/gst-queue-page.ts` + `data/hi/gst-queue-page.ts`.
- Tests: `packages/plugin-gst-invoices/test/queue-status.test.ts` (pure rules + DB tests for rows
  and stats; the DB part needs the local test Postgres).
