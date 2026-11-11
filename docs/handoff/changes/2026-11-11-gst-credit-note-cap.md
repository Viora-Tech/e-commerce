# GST invoices: credit notes never pass the invoice total (#1550)

- `issueCreditNotes` (`packages/plugin-gst-invoices/src/credit-notes.ts`) now works out what each
  invoice can still be credited (its total less live credit notes against it) for one-invoice
  orders too, not only for orders split across GSTINs. A refund with nothing left to credit makes
  no credit note (the hook logs nothing and moves on; the refund-voucher path still refuses an
  invoiced order).
- Test: `test/issue.test.ts` "never credits one invoice past its total across several refunds".
  The `seedRefund` helper reuses the order's captured payment (one capture per order).
- Found by the Phase 1b group 1 audit: `docs/audits/2026-11-11-apps-group-1.md`.
