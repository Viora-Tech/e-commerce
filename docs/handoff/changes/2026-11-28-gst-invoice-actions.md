# GST invoices: Email to buyer and Edit in the invoice page's ⋯, ⋯ menus, header order

Branch `fix/gst-invoice-actions` (from `origin/dev`). No issue. No migration.

## What changed

Owner's three asks after testing the GST invoices app live (28 Nov 2026):

- **Invoice page header** ("Tax invoice INV/26-27/0746"): one main button, **Email to buyer**,
  then a ⋯ menu with Edit invoice, Print and Download PDF (second commit). The email reuses the Invoices list's bulk Email
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

### Second commit (owner's follow-ups while checking on localhost)

- **Edit invoice moved into the invoice page's ⋯ menu**, first item. The Edit invoice card
  (`invoice-edit-card.tsx`) is gone. The menu item opens the same `InvoiceEditSheet`. Under the
  label a small second line says "Until this month's GSTR-1 is filed (due …)" or, greyed out,
  the lock reason (filed, closed, due passed, IRN, credited, cancelled, external), worded by
  `lockText` in `invoice-edit-lock.ts` from `gstInvoiceEditContent.card.locked`. Hidden for
  credit notes and other non-tax documents. `getEdit` is now loaded by `invoice-detail.tsx`
  and passed to `InvoiceDetailActions`.
- **Edit history** stays on the page as a small card (`invoice-versions-card.tsx`, the old
  card file renamed), shown only once the invoice was edited. I chose a card over a "Version
  history" menu item: each version has its own Open PDF button, which needs room.
- `ActionMenu` (`components/layout/action-menu.tsx`) gained an optional `description` on each
  item: a small second line under the label. It's additive, so other menus are unchanged.
- **Queue bulk bar**: Issue N invoices, then ⋯ with Mark as already invoiced (still opens its
  confirm) and Remove from queue (destructive; it had no confirm before and has none now).
- **Products (tax) bulk bar**: the HSN field with Apply, the GST rate picker, then ⋯ with
  Charge GST and No GST, then Clear. Returns and Settings have no bulk bars.
- **Header order**: ⋯ is always the right-most item with 1rem before it. Queue: Export GSTR-1,
  Issue N invoices, ⋯ (`QueueMoreMenu`). `GstExportButton` takes `beforeMenu` (default `true`
  for the app bar; the Queue passes it only while rows are ticked and Issue all is hidden).
  The invoice page puts the margin after Email to buyer.

## Tests

- None added. Typecheck run for `packages/api` and `apps/admin` only (admin again after the
  second commit).

## Left to do / for the owner to check

- On localhost: open an invoice, Email to buyer (needs the worker running for the toast to say
  "emailed"); an order with no email shows the button greyed with the reason on hover.
- Invoices list: tick rows, check the bar order and the ⋯ items; Recalculate GST only on the
  Tax invoices view.
- Header gap on Invoices, Returns and the Queue; on the Queue the ⋯ is last.
- Invoice page ⋯: Edit invoice on an open month, and greyed with its reason on a filed or
  cancelled invoice; an edited invoice shows the Edit history card.
- Queue and Products bulk bars: the ⋯ items.
