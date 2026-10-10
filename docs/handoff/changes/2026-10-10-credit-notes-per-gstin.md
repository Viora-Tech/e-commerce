# Credit notes per GSTIN; returns back to the parcel's warehouse

**Branch** `feat/credit-notes-per-gstin`, from `dev` after #377. **Migration
`0101_credit_notes_per_gstin`**: `invoice_refund_unique` becomes unique per refund + parcel;
backfill points one-parcel orders' credit notes at their parcel. PR 5 of the split-across-warehouses plan.

- **Credit notes** (`issueCreditNotes`, `packages/plugin-gst-invoices/src/refund-allocation.ts`,
  REFUND_ALLOCATION): an order with several issued parcel invoices gets one credit note per
  invoice the refund reduces, from that invoice's GSTIN and series, linked to its parcel. A refund
  for a return follows the returned units' parcels; any other refund is pro rata to remaining
  creditable value; no note exceeds what its invoice can still be credited. One invoice: exactly
  as before (`issueCreditNote` stays as the wrapper). The refund hook and the admin "credit note"
  action issue and render all of them.
- **Returns and pickups**: `shipFromFor` takes the parcel's `locationId`; return pickups go back to
  the location the most returned value left from (`returnPickupLocation`); a whole-order booking
  leaves from its parcel's location. Per-parcel booking UI is PR 6.
- **Tests run**: see the PR body.
