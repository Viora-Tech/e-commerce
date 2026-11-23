# GST invoices: search, sort and filters on the Queue and Invoices lists (23 Nov 2026)

Owner request, 23 Nov. Both lists now use the shared `ResourceTable` (the Orders and Products
table): "Search and filter" bar, Filter menu with chips, sortable column headers and sort menu,
views select, rows per page and the bulk bar. Everything is done on the server and kept in the
URL (`?query=&view=&due=&gst=&payment=&sort=&page=` on the Queue, `?query=&tab=&date=&gst=&source=&status=&sort=&page=` on Invoices).

## Queue (`/apps/gst-invoices`)

- Search: order number (`1042` or `#1042` matches exactly; also the printed name) or customer name.
- Sort: Date, Order number, Taxable, GST. **Default stays Date, oldest first** (IST day, then order
  number): it is the order `issueDrafts` numbers a batch in, so the list reads in the order the
  invoices will be numbered. Newest first is one click in the sort menu.
- Filters: Order date (This month, Last month, Last 7/30/90 days, custom; the day the draft became
  due, as before), GST number (only when the store has two or more), Payment (Prepaid / Cash on
  delivery, from `order.payment_method`).
- Views select: All / Ready / Needs fixing with counts (were the pill tabs).
- A draft's status is worked out in code, so the server reads the filtered queue, then sorts,
  splits the view and cuts the page (`plugin-gst-invoices/src/queue-arrange.ts`); counts cover
  every view and feed the figures above.
- Ticked rows: bulk bar with Issue, Mark as already invoiced, Remove (were in the More menu; the
  More menu keeps Add orders by number; its date dialog is replaced by the Order date filter).
  The header "Issue N invoices" issues the ticked ready rows, else every ready row up to one
  batch of 200 (fetched on click, since the page now holds one page of rows).
- A Date column now shows when the order became due (was a caption under the order number).

## Invoices (`/apps/gst-invoices/invoices`)

- Search: invoice number, order number or name, buyer name, buyer GSTIN.
- Sort: Date (default newest first), Number (financial year then serial), Total.
- Filters: Invoice date (same presets), GST number (two or more), Source (Issued here / Recorded
  outside), Status (Issued / Cancelled). The document type views stay (Tax invoices, Credit notes,
  Vouchers, Exports, All).
- **The month stepper is gone**: the list shows every date by default, newest first; This month /
  Last month are the first Date presets. Paging shows a total (new `count(*)`).
- Select all matching uses the new `gstInvoices.listIds` (up to 200, the bulk limit); bulk
  download, print, Recalculate GST and email take the ids.

## GST number picker

The header GST number picker is no longer on these two pages: the GST number is a Filter there
(same rule, shown only with two or more numbers). Returns and other GST pages keep the picker.

## Code

- Plugin: `src/list-query.ts` (search, payment filter, document ORDER BY and sort keys),
  `src/queue-arrange.ts` (queue sort, views, paging), `src/queue-list.ts` (`listQueue` moved out of
  `queue.ts`, re-exported there), `queuePage` in `queue-status.ts`, `listDocuments` takes `sort`,
  `source` and returns `total`, `dateKey`, `numberKey`.
- API: `routers/gst-invoices-lists.ts` (`queue.list`, `list`, `listIds`).
- Admin: `lib/gst-list-filters.ts` (URL params, IST date bounds, filter groups, API input),
  `queue-columns.tsx`, `invoice-columns.tsx`, `invoices-bulk-actions.tsx`, `use-gst-numbers.ts`;
  `queue-row.tsx` removed. Copy in `data/gst-list-filters.ts` with the Hindi overlay.
- The table also sorts the loaded page itself; each sortable column's value is the server's own
  key, so the two orders agree.

## Checks run

- `plugin-gst-invoices/test/list-query.test.ts` (pure: search, payment SQL, ORDER BY, keys, queue
  arrange): passed, run without the DB global setup. The DB-backed plugin tests were not run.
- Admin `lib/gst-list-filters.test.ts`, `components/apps/gst-invoices/*.test.tsx`,
  `lib/i18n.test.ts`: passed.
- Typecheck: admin and api pass. `plugin-gst-invoices` typecheck reports only errors inside
  `packages/core` (implicit any in blog, metaobjects, delivery options, theme), none in GST files.

## Left as is

Old copy keys no longer used (month stepper, date dialog, select-all strings in
`data/gst-invoices.ts` and `data/gst-queue-page.ts`) were not removed.
