# GST: a sale cancelled before dispatch cancels its invoice, no credit note

Owner, 14 Nov 2026 (#2471): an order cancelled and refunded in full before any parcel left, with
nothing in a filed GSTR-1, never happened for GST. `voidUnshippedSale`
(`packages/plugin-gst-invoices/src/void-unshipped.ts`) cancels its tax invoices, and any credit
note already made for the refund, on `refund.created` (instead of a credit note) and on
`order.cancelled` (the refund can come first). Part refunds, shipped parcels (picked up or later)
and filed months still get a credit note. `cancelInvoice` can now cancel an issued credit note,
and an invoice is blocked only by live (not cancelled) credit notes.
