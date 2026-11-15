# Bulk ship: edit a row in place, not in a dialog

Design audit row E ("bulk-edit opens a dialog on top of the bulk-ship drawer"). The owner
approved a Shopify bulk-editor style edit instead.

- **Shipments › To ship › Book selected** (bulk ship drawer): the pencil, "Change", a row's fix
  button or a click anywhere on the row (not on its controls) now opens that order's editor
  **under its own row** (`create-shipment/bulk-edit-inline.tsx`, a full-width table row). It shows
  the same fields the dialog had, through the same `BulkEditPackage` (items, box, weight, L × W × H,
  charged weight) and `BulkEditShipping` (courier with the shopper's checkout choice, payment,
  insurance, charge) parts, and the "needs package" chip.
- Footer: Skip this order / Book this order on the left; Cancel and **Apply** on the right.
  Apply goes through `useBulkShip().saveEdit`, the same call the dialog's Save made, so a changed
  weight, size or payment re-quotes that one order (`shipments.quote`) and errors toast as before.
  Cancel and **Esc** close it without changes (Esc is caught in the drawer's `onOpenChange`, so the
  drawer stays open; Esc inside an open select only closes the select). Only one row is open at a
  time; opening another drops the unapplied one. The pencil shows `aria-expanded` and closes the
  editor when pressed again; focus moves into the editor on open and back to the pencil on close.
- Phone width / bottom sheet: the table still scrolls sideways (min 68rem), but the editor panel
  is sticky at the left and exactly as wide as the visible table (`@container` on the scroller,
  `w-[100cqw]`); its two halves sit side by side from a 48rem container (`@3xl:grid-cols-2`) and
  stack below that.
- Dropped with the dialog: the ‹ › order navigation and "Save and next" (click the next row
  instead).
- Removed: `bulk-edit-dialog.tsx`, `use-choice-for-order.ts`, `batchPosition`/`linePosition` (and
  their test), copy `createShipmentContent.bulkEdit` and `bulkShip.editPopup.saveNote`/`close`
  (English and Hindi). Added copy `editPopup.title`, `applyNote`, `cancel`, `apply` (with Hindi).
- Tests: `bulk-ship-drawer.test.tsx` (opens in place with no dialog, opens from a row click, one
  row at a time, Apply re-quotes with the new weight, Cancel and Esc leave it unchanged).
