# Edit an issued GST tax invoice until its month is filed

Branch `feat/gst-invoice-edit` (from `origin/dev`). Migration `0273_gst_invoice_version`
(new table only, `when` 1796160000000, after 0272).

## What changed

- Owner, 28 Nov 2026: an issued tax invoice can be corrected in place until its month's GSTR-1
  is filed (Zoho Books / Tally practice). **Editable:** line quantity (0 drops the line), unit
  price and line discount; shipping and other charge amounts (0 drops the charge); buyer name,
  address lines, GSTIN and place of supply. Number and date never change (no date edit).
- **Lock rule** `editLockOf` in `packages/plugin-gst-invoices/src/edit-invoice.ts`: locked when
  not an issued tax invoice, cancelled, recorded from outside Koomerce, an IRN on the snapshot
  (`einvoice.irn`; nothing fills it yet), the month marked filed (`reported_period` or
  `invoice_period.gstr1_filed_at`), the month closed, after the GSTR-1 due date (`gstr1DueDate`:
  the 11th of the next month, IST, editable through that whole day; the app has no QRMP setting,
  so monthly only), or a live credit note against it (its `original.number`).
- **Recalculation** `rebuildDocument` in `packages/invoices/src/edit.ts` uses the issue engine's
  own steps: `splitByRate` (principal rate for charges), `groupsFor` (now exported from
  `document.ts`, the same per-rate tax as `buildDocument`), `applyTax`, `totalsOf`, the rate and
  HSN summaries and `amountInWords`. A changed place of supply recomputes inter/intra state.
  `editChanges` writes the diff lines.
- **Save** `editInvoice`: row `FOR UPDATE`, lock re-checked, GSTIN validated, the replaced
  snapshot stored in `invoice_version` (version 1 = as first issued; who, when, reason,
  changes), the row's snapshot, totals columns and `invoice_line` rows replaced, PDF re-rendered,
  an order timeline note. The Activity log records `gstInvoices.saveEdit` with before/after
  totals. GSTR-1, Returns, the Queue stats and dashboards read the invoice row, so they use the
  latest version.
- `regenerateKeepingEdits` replaces `regenerateDocument` in the `regenerate` route: an edited
  invoice gets the GSTIN / export details on its own snapshot instead of a rebuild from the
  order. `refreshInvoiceGst` refuses an edited invoice ("change it with Edit invoice").
- API `packages/api/src/routers/gst-invoices-edit.ts`: `gstInvoices.getEdit` (orders.read: lock,
  form, history), `saveEdit` (orders.write), `getVersionPdf` (orders.read, rendered on the fly).
- Admin (`apps/admin/src/components/apps/gst-invoices/`): `invoice-edit-card.tsx` on the
  invoice page (button or lock reason + credit note guidance, history), `invoice-edit-sheet.tsx`
  with `invoice-edit-lines.tsx` / `invoice-edit-buyer.tsx` / `invoice-edit-form.ts`,
  `invoice-history-list.tsx` ("Edited N times", Open PDF per version), `filing-reminder.tsx` on
  Queue and Invoices from the 1st to the 11th (hidden once last month is marked filed). After
  save the toast offers "Email corrected invoice to buyer" (`gstInvoices.emailInvoice`). The
  order card's "Need to change this invoice?" mentions Edit invoice when allowed.
- Copy: new `data/gst-invoice-edit.ts` + Hindi `data/hi/gst-invoice-edit.ts` (kept out of
  `data/gst-invoices.ts`, already over the 500-line file-size limit); the panel's locked body
  text in `data/gst-invoices.ts` was reworded.
- Merchant guide: `apps/docs/content/merchant-guide/money-and-gst/gst-invoices.mdx`, "Edit an
  invoice before you file".

## Tests

- `packages/invoices/test/edit.test.ts`: unchanged form rebuilds the same invoice; an edit equals
  `buildDocument` with the same values fresh; place of supply switch; line discount; drops and
  refusals; diff lines.
- `packages/plugin-gst-invoices/test/edit-lock.test.ts`: due date, filed, closed, cancelled, IRN,
  external, credited.
- `packages/api/test/gst-invoice-edit.test.ts`: version row + same number + same tax as fresh +
  GSTR-1 summary reads the latest + version PDF; filed and cancelled refused; orders.read only
  cannot save.

## Left to do / for the owner to check

- QRMP (quarterly) filers: the app has no filing-frequency setting, so the due date is always the
  11th of the next month.
- Lines cannot be added on the invoice (only changed or dropped); add items by editing the order.
