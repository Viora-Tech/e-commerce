# Recalculate GST from products on an issued invoice

An order keeps the GST it was placed with, so an invoice for a product that had no GST rate at the
time (order #2419, INV/26-27/0684) shows ₹0 GST even after the merchant sets 18%.

The tax invoice page now has a "GST from products" card with a Recalculate GST button. It shows
only on an issued tax invoice that is not yet reported in GSTR-1 (the same rule as Cancel).

- `refreshOrderLineGst` (core, `order/refresh-gst.ts`) sets each order line's GST rate and HSN from
  its product as checkout would today. Prices do not change; only the split into taxable value and
  GST does.
- `refreshInvoiceGst` (plugin, `refresh-gst.ts`) checks the invoice first (`gstRefreshBlock`:
  issued tax invoice, not cancelled, not a queued draft, not filed) so a locked invoice leaves the
  order alone, then rebuilds it with `regenerateDocument`: same number and date, PDF set to pending.
- API: `gstInvoices.refreshGst({ id })` re-renders the PDF and returns `changedLines`.
- Tests: `packages/plugin-gst-invoices/test/refresh-gst.test.ts`.

Other tax invoices of the same order (split parcels) are not rebuilt; press the button on each.
