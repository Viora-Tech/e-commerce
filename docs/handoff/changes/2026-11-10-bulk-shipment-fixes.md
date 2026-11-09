# Bulk Create shipments quote and bulk Add to invoice queue toast (#1426, #1427)

Branch `fix/bulk-shipment-quote`. No migration.

**#1426, bulk Create shipments step 2 empty / "Book 0 shipments".** `shipments.quote` refused the
whole batch with 400: a parcel whose products are saved with 0 g (Shopify import's "no weight")
and no package size came out of `shipments.prepare` with `weightGrams: 0`, and the quote schema
needs `int().min(1)`. Fixes:
- `packages/core/src/shipping/parcel.ts`: `resolveParcelWeightGrams` treats a total below 1 g as
  unknown (box weight, as for a missing weight); `resolveParcelPackage` ignores a package with a
  0 cm side. Booking (`core/shipping/shipments.ts`) uses the same functions, so it gets this too.
- `apps/admin/.../create-shipment/flow-state.ts`: `bulkQuoteRequests` builds the bulk request and
  drops values the server refuses (weight < 1 g, a 0 cm side, a bad declared value).
- `bulk-shipment-flow.tsx`: a failed quote shows an alert with the reason and "Check again"
  instead of an empty table.

**#1427, "Added 2 to the invoice queue" for many orders.** `gstInvoices.queue.add` counted only
new invoices; orders already queued or already invoiced were counted nowhere. It now returns
`alreadyQueued` and `alreadyInvoiced` (orders), and with `skipIneligible` skips cancelled orders
too (they failed the whole batch before). The toast names every group
(`data/order-app-actions.ts`, Hindi in `data/hi/`).

Tests: `core/src/shipping/parcel.test.ts`, `admin/.../flow-state.test.ts`,
`admin/src/apps/order-action-procedures.test.ts`, `api/test/shipment-details.test.ts` (prepare →
quote with 0 g products), `api/test/order-actions.test.ts`.
