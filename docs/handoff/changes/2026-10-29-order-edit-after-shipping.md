# Order edit follow-up: rate names, editing after shipping (#923)

Branch `fix/order-edit-followup`. No migration. Two owner decisions after PR #923.

## 1. The shipping rate's name instead of "Shipping"

- The edit page's field is now "Shipping rate name" (still `order.shipping_rate_name`).
- Order page (`order-totals.ts`), storefront order page (`checkout.ts` `shippingRow`) and the
  edit page summary label the shipping row with the rate's name ("Bluedart"), "Shipping" only
  when there is none. Same as the discount row already did with its label.
- Emails: order emails now have a shipping row above the GST rows (`TemplateData.shipping`,
  built in `core/notifications/deliver.ts`, labelled with the rate name).
- Invoices already print "Shipping charges (Bluedart)" (`shippingChargeDescription` in
  `@commerce/invoices`). New: an **issued** invoice that bills the same amount but names the old
  rate (or the old discount reason) is cancelled and re-issued by `reviseForOrderEdit`, under the
  same guards as #923 (not in a filed GSTR-1, no credit note on the order). One that cannot be
  cancelled is left and reported in app activity (`oldNames`). Queued drafts were already rebuilt.

## 2. Editing an order after it shipped

- `canEditOrder` (`core/order/edit-rules.ts`): not imported and `status = 'open'`, whatever the
  fulfilment status. Completed and cancelled orders still cannot be edited. `editsAfterShipping`
  says when to warn (fulfilled, shipped, delivered, returned).
- The edit page and the review dialog show "This order has shipped. Changes won't update the
  shipment; create a new shipment or return if needed." (`edit-shipped-alert.tsx`), also when a
  shipment is booked on a partly packed order. Saving is allowed.
- Rules kept from #923: a line cannot go below what was packed or shipped (that is a return), gift
  card lines cannot change, lines on a return cannot be repriced or removed.
- Stock: added units go to a new parcel (a packed parcel is no longer `open`), so the new items are
  shipped separately.
- **Money of packed parcels stays put** (`retaxOrder`): a parcel that is `fulfilled` and whose lines
  the edit did not reprice keeps its subtotal, discount, shipping, total and GST; the rest of the
  order's discount, fee and shipping is shared over the other parcels. Before, adding an item
  re-split the order's shipping and discount over every parcel, so the parcel that had left (and
  its issued invoice) changed and the invoices no longer added up. Falls back to working out every
  parcel again when nothing else is open, or the charges went below what the packed parcels hold.
- GST documents (`plugin-gst-invoices/src/order-edit.ts`), same rules as #923: queued drafts
  rebuilt; an issued invoice whose parcel now bills more is cancelled and re-issued if allowed,
  else reported; a lower amount is credited by the refund's credit note. New: for an unpaid order
  (cash on delivery, invoiced at dispatch) a cancelled invoice is re-issued through the dispatch
  rule (`reissue: 'fulfilled'`); before, only paid orders got the replacement.
- Timeline: "Order edited after shipping (the shipment was not changed): ...".

## Tests

- `core/src/order/edit.test.ts`: a shipped order with shipping takes an added item (packed parcel
  keeps its money, the new parcel bills ₹500 with no shipping, order GST is the sum, the note says
  after shipping, going below the shipped quantity is refused); a completed order is refused.
- `plugin-gst-invoices/test/parcels.test.ts`: renamed rate re-issues the invoice that carries
  shipping; a filed one is reported in `oldNames`.

## Not done

- No debit notes exist; a filed invoice that now bills too little is still reported for the
  merchant to handle, as in #923.
- A lower amount with no refund (store keeps it, or an unpaid order already invoiced) still leaves
  the issued invoice as it was, as in #923.
