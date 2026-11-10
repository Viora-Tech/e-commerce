# GST invoices: bulk "Recalculate GST" (#1456)

- `gstInvoices.bulkRefreshGst` (`gst-invoices-order-actions.ts`): takes the list's selection (ids, or
  everything matching the filter, capped like the other bulk actions) and runs the existing
  per-invoice refresh on each. Invoices it cannot take (filed in GSTR-1, cancelled, not a tax
  invoice) are skipped and counted; returns `{ updated, unchanged, skipped }`.
- Invoices list: a "Recalculate GST" button in the selection bar on the Tax invoices tab; the
  page reloads after it. Copy in `data/gst-invoice-refresh.ts`.
- The bulk selection schema moved to `routers/gst-invoices-selection.ts` (shared by download,
  print, email and this); the sweep allow-list entry for the search box followed it.
