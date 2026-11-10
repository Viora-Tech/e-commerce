# GST invoice page: Items and GST card (#1458)

`invoice-lines-card.tsx` on the invoice page, from the document snapshot (so it matches the PDF):
bill-to / ship-to with GSTIN, place of supply, each line (item, SKU, HSN, qty, GST %, taxable
value, tax, total), then discount, taxable value, CGST+SGST or IGST, total GST and invoice total.
It refreshes after Recalculate GST (the page reloads the document). Copy: `data/gst-invoice-lines.ts`.
Verified on a local test invoice.
