# Edit order after fulfilment and delivery (#1014, audit 21)

- `canEditOrder`: open **or completed** (delivered) orders can be edited; cancelled and imported
  history cannot.
- Packed units stay as they are: no fewer, and a line with packed units keeps its price (the
  server refuses with `fulfilled_line`; the editor locks the price and says why).
- `OrderEditSchema` gains `custom[]` (title, quantity, price, taxable, HSN: booked on the hidden
  Custom item variant, no stock held) and `lines[].restock` (default on; off writes the units off
  like a cancel without restock). Timeline lines say "(custom item)" / "(not restocked)".
- New items after fulfilment go in a new open parcel (existing `holdAddedUnits`), so a delivered
  order goes back to open / partially fulfilled. A held order's new parcel is held too.
- Editor: Add custom item (the draft dialog), a per-line "Add discount" (amount or percent off each
  unit, applied as the new unit price), Restock checkbox under a removed or reduced line, a live
  summary ("No changes have been made" → the change list, new total, Amount to collect / Refund
  owed), "Update order" disabled until something changes; "Reason for edit" and "Notify customer"
  stay in the review step.
- Known gap: an order marked delivered by hand keeps `delivered_at`, so once the new parcel is
  packed it reads Delivered without a second "Mark as delivered".
