# GST invoices: "Already invoiced" in the Queue (18 Nov 2026)

Owner request: some orders were invoiced earlier outside Koomerce (by hand or in the previous
billing system). Staff can now record that invoice instead of issuing a second one.

## What staff see

- Queue: every row has **Already invoiced** beside Issue / Fix. It opens a dialog asking for the
  invoice **number** (required, up to 16 characters) and **date** (required, starts at the
  order date in IST, no future dates).
- The order leaves the Queue. The order card lists the invoice with its number and says
  "Recorded, invoiced outside Koomerce"; there is no Download button.
- The invoice page shows the same note in place of Print and Download.
- Not in the review step or as a bulk action: each record needs its own typed number.

## How it is stored

- Migration `0254_gst_invoice_source.sql`: `invoice.source` (`koomerce` default, or `external`),
  and `pdf_status` may now be `none` (no PDF to draw). Additive, safe for a rolling deploy.
- `recordExternalInvoice` (`packages/plugin-gst-invoices/src/record-external.ts`) turns the
  queued draft into an `issued` tax invoice with `source = external`, `pdf_status = none`, the
  typed number (upper-cased) and date. The snapshot, lines and totals come from `orderSnapshot`,
  the same code issuing uses, so taxable value and GST match a normal invoice.
- API: `gstInvoices.queue.recordExternal` (`packages/api/src/routers/gst-invoices-record.ts`).

## Numbers

- Refused when another document of the same GSTIN already has that number in the invoice
  date's financial year (issued or cancelled), with the other order named in the message. The
  existing unique index `invoice_number_unique` backs this up.
- When the number is one our own tax invoice series would print for that GSTIN and year
  (e.g. `INV/26-27/0042`), the record is filed under that series (`series_id`, `seq`) and the
  series counter moves past it (`greatest(next, seq + 1)`), so issuing never hands it out again.
  This can leave a gap in our series if the typed number is ahead of the counter.
- Other numbers (`VI/26-27/642`) keep `series_id` null and `seq` = their trailing digits.
- Takes the same per-store advisory lock as batch issuing. A closed month is refused; a month
  already marked filed takes the record as reported (as `markFiled` would).

## Returns

- GSTR-1 (CSV and portal JSON), GSTR-3B and the sales register read issued tax invoices by
  date, so records count automatically.
- Table 13 / sales register ranges: a record outside our series forms its own row keyed by its
  prefix (`documentSeriesKey`), e.g. `VI/26-27/642` to `VI/26-27/642`.

## No PDF anywhere

`renderAndStore` skips records, `pdfBytes` refuses them, order emails do not attach them, the
storefront link is not offered (and the route 404s), bulk download/print/email leave them out.
Regenerate keeps `pdf_status = none`.

## Cancel and credit notes

Same as a normal invoice: cancel works until the month is filed (the number stays used and is
reported cancelled in Table 13); refunds make our credit notes against the recorded number.

## Tests

`packages/plugin-gst-invoices/test/record-external.test.ts`: duplicate refusal (recorded,
our own, cancelled), our series skipping a recorded number, GSTR-1 CSV/JSON inclusion with its
own Table 13 row. Not run on the branch (owner's workflow: tests run on dev).
