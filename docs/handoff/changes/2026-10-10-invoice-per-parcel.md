# One GST invoice per parcel

**Branch** `feat/invoice-per-parcel-v2`, stacked on `feat/gst-per-parcel` (#371). **Migration
`0100_invoice_per_parcel`**: `invoice.fulfillment_order_id`, `invoice_order_kind_live` now unique per
order + parcel + kind, backfill points one-parcel orders' tax invoices at their parcel. PR 4 of the
split-across-warehouses plan.

- **Queue**: `enqueueOrderParcels` makes one draft per live parcel under its GSTIN (plugin hook
  and "Add orders" use it); `enqueueOrder` stays as the one-parcel wrapper. `existing(..., parcelId)`
  finds a parcel's invoice; `liveDocuments` lists them all (email attachments, refund vouchers,
  removing drafts of a cancelled pre-order).
- **Document** (`parcels.ts`, `orderSnapshot(..., parcelId)`): the parcel's units, its stored
  share of discount/fee/shipping and its stored GST; a parcel without stored figures (converted
  drafts) takes a goods-value share and the tax is worked out from its lines and GSTIN.
  Composition GSTIN parcel = bill of supply. The receipt voucher's advance is cited once.
- **Credit notes**: an order with more than one issued invoice refuses (`InvoiceError`), logged by
  the refund hook. PR 5 allocates refunds per GSTIN.
- Parcels are made on demand for older orders (`ensureFulfillmentOrders`, new core subpath
  `@commerce/core/fulfillment-orders`). `deleteFulfillmentOrders` unlinks invoices too.
- **Tests run**: see the PR body.
