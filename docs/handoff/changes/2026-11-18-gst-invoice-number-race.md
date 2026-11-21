# GST invoice PDF printed the order number (#1784)

INV/26-27/0708 (Waimers order #2482) printed "#2482" with no invoice number and the draft's date.

- **Cause**: issuing (Queue → Issue, and Generate GST invoice) added the worker's `render` job inside
  the request transaction. A worker that ran before the commit read the queued draft (no number,
  draft date), rendered it, and marked the PDF ready once the issue committed; every Print then
  served that file.
- **Fix**: render jobs are enqueued in `context.afterCommit`. `renderAndStore` keeps a file only if
  the invoice's `updatedAt` did not change while it rendered (else renders again, up to 3 tries),
  and `printableSnapshot` gives an issued document its row number if the snapshot lacks it.
- **Already affected invoices**: Recalculate GST (or any rebuild) renders them again. A one-time
  `UPDATE invoice SET pdf_status = 'pending' WHERE status = 'issued'` makes every stored PDF
  render again on its next download (owner to approve before running it on live).
- Same PDF: a 3pt gap between item columns (a long name no longer runs into the HSN), "For
  <seller>" printed only without a signature image, and the shipping line is "Shipping charges"
  alone. The shipping line keeps the principal goods' HSN on purpose (composite supply).
