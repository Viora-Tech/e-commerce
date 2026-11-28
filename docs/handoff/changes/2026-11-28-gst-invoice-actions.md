# GST invoices: Email to buyer on the invoice page, ⋯ menus, Export spacing

Branch `fix/gst-invoice-actions` (from `origin/dev`). No issue. No migration.

## What changed

Owner's three asks after testing the GST invoices app live (28 Nov 2026):

- **Invoice page header** ("Tax invoice INV/26-27/0746"): one main button, **Email to buyer**,
  then a ⋯ menu with Print and Download PDF. Edit stays in its own card (`InvoiceEditCard`,
  #1811); it was never a header button. The email reuses the Invoices list's bulk Email
  (`gstInvoices.bulkEmail` with this one id, the same `email` job and `document_copy` email);
  the page then polls `gstInvoices.batch` (about 18 seconds) and toasts "Invoice emailed to …"
  or the failure, or "on its way" if the worker is slow. Disabled with a tooltip when the order
  has no email. Code: `apps/admin/src/components/apps/gst-invoices/invoice-detail-actions.tsx`,
  used by `invoice-detail.tsx`.
- `gstInvoices.get` now returns `buyerEmail` (the order's email, `null` when blank) via
  `orderEmail` in `packages/api/src/services/gst-invoices.service.ts`.
- **Invoices list bulk bar**: "N selected ▾" (unchanged, `SelectionBar`), then **Email to
  buyers**, then a ⋯ menu with Download zip, Print and Recalculate GST (tax invoices view only).
  Same handlers. `invoices-bulk-actions.tsx`.
- **Top-right header** (GSTIN chip, Export GSTR-1 ▾, ⋯): Export now has a 0.5rem right margin,
  so with the row's 0.5rem gap there is 1rem before ⋯. Set on `GstExportButton` itself, which
  is used in both the app bar (`HeaderAction`, every GST page but the Queue) and the Queue's
  own header (`ownHeader`), so both match. Other apps' header actions are unchanged.
- Copy: `apps/admin/src/data/gst-invoice-actions.ts` with Hindi `data/hi/gst-invoice-actions.ts`
  (`data/gst-invoices.ts` is already over 500 lines, so the new keys went in their own file).

## Tests

- None added. Typecheck run for `packages/api` and `apps/admin` only.

## Left to do / for the owner to check

- On localhost: open an invoice, Email to buyer (needs the worker running for the toast to say
  "emailed"); an order with no email shows the button greyed with the reason on hover.
- Invoices list: tick rows, check the bar order and the ⋯ items; Recalculate GST only on the
  Tax invoices view.
- Header gap on Invoices, Returns and the Queue.
