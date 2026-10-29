# Order editing fixes (issues 915–920)

Branch `fix/order-editing-915`. No migration: the labels use the order's existing
`discount_label` and `shipping_rate_name` columns.

- **#915 Edit order is easy to find:** an "Edit" button in the order header (it left the
  "More actions" menu) and "Edit order" on the Payment summary card, both while the order can be
  edited (`canEditOrder`: open, not shipped, not imported history). The edit page's summary
  already shows paid, customer owes and to refund; the review dialog settles it.
- **#917 / #918 Price of an existing line:** `OrderEditSchema.lines[].unitPricePaise` (optional;
  omitted keeps the price). `planOrderEdit` moves the subtotal by the difference, `editOrder`
  writes the line's price, `retaxOrder` recomputes GST and parcel totals, and the difference is
  settled like any edit (balance owed, or a refund tagged "Order edited", which brings a credit
  note; a higher price re-issues an unfiled invoice through `reviseForOrderEdit`). Gift card lines
  and lines on a return cannot be repriced. Same-quantity repricing moves no stock (fixed a path
  that pushed a zero-unit hold).
- **#919 Labels for shipping and discount:** "Shipping label" and "Discount reason" fields on the
  edit page (`shippingLabel`, `discountLabel` in the edit input; blank clears, omitted keeps). Saved
  to `order.shipping_rate_name` / `order.discount_label`, so the order page shows
  "Shipping (Bluedart)" and "UPI discount"; the timeline note lists label changes. GST documents
  print "Shipping charges (Bluedart)" and "Discount (UPI discount)" (`SourceOrder.shippingLabel` /
  `discountLabel`, snapshot `discountLabel`, nullish so older snapshots parse). Invoices print the
  checkout's shipping rate name too now (e.g. "Shipping charges (Standard)").
- **#916 Draft order, existing customer's email:** typing an email that belongs to a saved
  customer links them on blur, fills a blank name and phone, and fills an empty shipping address
  from their book, else from `customer.default_address` (guests who checked out without an address
  book). Typed details are never overwritten.
- **#920 Where are invoices:** the GST invoices card is now titled "Invoices", sits right under the
  Customer card (anchor `#order-invoices`), links to "All invoices", and "More actions" has
  "View invoices". Only when the gst-invoices app is installed.

Tests: `packages/core/src/order/edit.test.ts` (reprice down with labels and refund, reprice up
with a balance, label-only edit and its no-change guard).
