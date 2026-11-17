# ShipGlobal bookings send the GST export invoice number

ShipGlobal's export papers carry `invoice_no`, and Koomerce sent the order number (#2460), so the
papers never matched the GST export invoice (VI/EXP/26-27/003). Owner asked 16 Nov.

- `CreateShipmentInput.invoiceNumber` (optional): the order's issued GST tax invoice number.
- `core/shipping/invoice-number.ts` `issuedInvoiceNumber`: the latest issued `tax_invoice` for the
  order, the booked parcel's own invoice first. Reads the GST invoices app's `invoice` table by
  name (core does not import apps). Null when none was issued.
- `createShipmentForOrder` passes it; ShipGlobal sends it as `invoice_no`, else the order number
  as before. Other couriers ignore the field.

Tests: `shipments.test.ts` (issued wins over cancelled), `shipglobal.test.ts` (number and blank
fallback).
