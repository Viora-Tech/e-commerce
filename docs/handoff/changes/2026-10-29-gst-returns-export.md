# GST returns: GSTR-1 JSON and GSTR-3B summary

Branch `feat/gstr-export`. No migration.

- **GST invoices › Returns** now picks a GST number and month and shows: warnings ("Check before
  you upload"), GSTR-1 totals per table with Table 13, and GSTR-3B 3.1(a)/(b)/(c) and 3.2. The
  filed/closed switches moved into a "Filing status" card under it.
- Downloads: GSTR-1 JSON for the portal's offline upload, GSTR-1 summary CSV, the existing
  per-table CSV zip, GSTR-3B as CSV or PDF.
- Pure builders in `packages/invoices`: `gstr1-json.ts` (`buildGstr1Json`), `gstr3b.ts`
  (`buildGstr3b`, `gstr3bCsv`, `gstr1Totals`, `gstr1SummaryCsv`), `gst-return-checks.ts`,
  `gstr3b-pdf/`. 3B is derived from the GSTR-1 JSON so the two agree.
- Plugin: `gstr1Inputs` (shared loader; credit notes now pair by the invoice number they print
  and orphans are reported instead of dropped), `gstReturn` in `returns.ts`.
- API: `gstInvoices.returns.summary | gstr1Json | gstr1Csv | gstr3b` (`orders.read`), in
  `routers/gst-invoices-returns.ts`; MCP marks them as reads.
- `gstStateName` added to `@commerce/core/gstin`.
- Copy: `gstReturnsContent` (+ Hindi); the old `gstInvoicesContent.returns` is gone.
- Docs: merchant guide "GST returns", developer docs "GST returns (GSTR-1, GSTR-3B)" (JSON
  shape and version followed).
- Tests: `packages/invoices/test/gst-returns.test.ts`, `packages/api/test/gst-returns.test.ts`.

## Owner choices still open
- HSN B2C tab includes exports; rate-0 lines reported as nil-rated (not exempt); HSN `desc` is
  the first product title (30 chars), not the GST HSN master text.
- No turnover-based 6-digit HSN check (only "at least 4 digits").
- Not yet tried against a real portal upload.
