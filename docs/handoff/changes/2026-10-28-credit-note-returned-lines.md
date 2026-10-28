# Credit notes for returns credit the returned units (#872)

A credit note used to spread a part refund over every line of the invoice by value. That
included shipping and goods at other GST rates, even when the refund was for one returned item.
Under s.34 a credit note for returned goods should relate to those goods, at their rate.

## What changed

- **Invoice lines** now record the order line they bill (`orderLineId` in the document
  snapshot; optional, so older snapshots still parse). Shipping and fee lines have none.
- **`buildCreditNote`** (moved to `packages/invoices/src/credit-note.ts`) takes `returned`
  units:
  - A refund equal to the invoice total still reverses it line for line.
  - A refund for a return credits the returned units at their own rate and quantity.
  - A refund below the returned units' invoiced value (a fee kept back) scales them down.
  - A refund above it (shipping refunded too) spreads the rest over the other lines.
  - Any other refund (goodwill, a price adjustment), or an invoice issued before lines
    recorded their order line, stays pro rata over every line, as before.
- **GST invoices plugin:** `refundReturnedUnits` finds the return that lists the refund and
  splits its units over the parcels that sent them, first parcel first (the same rule the
  per-GSTIN split already used; `refundWeights` now uses it). `issueCreditNotes` passes each
  invoice its own returned units.
- **The settings preview's sample credit note** returns the diya set at its billed value, so
  it shows one 18% line.

## Not changed

Refunds made from the order page are amounts only, so they stay pro rata. Letting the merchant
pick returned lines there would need refund lines stored with the refund; that is a follow-up
if wanted. A return (Orders → Returns) already records its lines.

## Tests

- `packages/invoices/test/documents.test.ts`: the issue's case (12% kurta, 18% diya,
  shipping), the fee-kept and extra-refund cases, and the fallbacks.
- `packages/plugin-gst-invoices/test/parcels.test.ts`: a return refund's credit note holds
  only the returned unit.
