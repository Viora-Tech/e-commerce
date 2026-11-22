# GST invoices: "Already invoiced" without number and date (23 Nov 2026)

Owner's request: old orders imported from Shopify (#2073, #2138 on Waimers) were invoiced long
ago in the previous system, and their invoice numbers and dates are gone. "Already invoiced"
now works without them.

## What changed

- **Dialog:** the number and date fields are optional and start blank. Both filled: recorded as
  before (counted in GSTR-1 and GSTR-3B, number kept used in the series). Both blank: "Mark as
  invoiced". Only one filled: the button is off and the dialog asks for both or neither.
- **API:** `gstInvoices.queue.recordExternal` takes `number` and `invoiceDate` as optional
  (both or neither, checked in `recordAlreadyInvoiced`). New
  `gstInvoices.queue.recordExternalMany({ ids })` (up to 500, `orders.write`) marks many rows
  without details and returns `{ recorded, skipped: [{ id, reason }] }`.
- **Record without details** (`packages/plugin-gst-invoices/src/record-without-details.ts`): the
  queued draft becomes `status` issued, `source` external, with no number, no date, no PDF
  (`pdf_status` none); it keeps the draft's figures. No migration: such a row is
  `source = 'external' and number is null` (`detailsMissing`).
  - No invoice date puts it in no return month, so GSTR-1, GSTR-3B, the sales register, the
    Queue stats and Mark filed never count it.
  - It stays a live tax invoice, so the paid, fulfilled and manual rules never queue the order
    again. The order states say `invoiced` + `invoiced-outside`: Generate, Add to queue, Email
    and Download are all hidden.
  - No credit note is made against it on a refund (`issueCreditNotes` skips it), order edits
    leave it alone (`reviseForOrderEdit`), and Cancel is refused (cancelling would free the
    parcel to be queued again); Undo is the way back.
  - Timeline note: "Marked as already invoiced outside Koomerce, without the invoice's number or
    date. Reported in the previous system's GST returns, not in Koomerce's."
- **Undo** (`undo-external.ts`) works for both kinds; for one without details it skips the
  period checks (no date) and notes "for this order (no invoice details)".
- **Queue bulk:** tick rows (any status, HSN missing included), More, "Mark as already
  invoiced", confirm with the count. Skipped rows (test or cancelled order, already gone) toast
  with the first reason.
- **Where it shows:** the invoice page and the order card say "Invoiced outside Koomerce,
  details not recorded" and "Reported in your previous system's returns, not in Koomerce's."
  The Invoices list shows the date as "Not recorded" and sorts these last. Refresh GST and
  Cancel are hidden on them.
- Copy in `apps/admin/src/data/gst-already-invoiced.ts` + Hindi; MCP action docs regenerated.

## Tests

Run, pass: `packages/plugin-gst-invoices/test/record-without-details.test.ts` (new: record
blank, both or neither, returns exclusion, never re-queued, cancel refused, bulk, undo),
`record-external.test.ts`, `order-states.test.ts`, `issue.test.ts`, `parcels.test.ts`;
typecheck of plugin-gst-invoices, api, admin.

Check on localhost: Queue, tick a few old orders, More, Mark as already invoiced; they leave the
queue, the order's More actions shows no Generate, and the October return does not change.
