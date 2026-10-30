# Messages Shopify has and we lacked (#168)

New store templates (`packages/notifications`: content in `templates/content-parts.ts` →
`orderUpdateTemplates`, samples, names, WhatsApp params in `notifications-whatsapp`), each a row
in Settings › Notifications with its preview (EN + HI copy in `apps/admin/src/data/notifications.ts`):

- **`order_edited`** (Orders, auto, email + WhatsApp). `order/edit.ts` writes `order.edited`
  with `notifyCustomer: false` unless the items or total changed; also skipped when the edit's
  balance request with the pay link already went (that one says "your order was updated"), and
  when staff untick "Send the customer the updated order" in the edit review dialog (new
  `notifyCustomer` on `orders.edit`). `order.edited` is now repeatable (each edit sends).
- **`payment_pending`** (Orders, auto). The unpaid-expiry tick (`apps/worker/src/payments-expiry.ts`)
  first runs `queuePaymentPendingNudges` (`core/payments/pending-nudge.ts`): "Payment pending"
  orders per the #1001 rules (cart checkout, online method, unpaid, not imported) still open,
  placed 10 minutes ago (or half the store's expiry window when shorter) and less than a day
  ago, with no `order.payment_pending` outbox row yet, get one. At most once per order; delivery
  checks again (open, unpaid) so a paid or cancelled order is never nudged. Link: the thank-you
  page, which has "Retry payment". Nothing is queued while the message is off.
- **`shipping_update`** (Orders, auto). Fired by `shipment.tracking_updated` (repeatable, carries
  `shipmentId`): (1) a cancelled label booked again (`createShipmentForOrder`), (2) the new
  "Edit tracking" on a hand-entered shipment (`shipments.updateTracking`, `core/shipping/tracking-edit.ts`,
  timeline line, refused for courier-app shipments). Sent only when `order_shipped` already went;
  carries the new AWB, courier and link. Order messages now read the live, newest shipment
  (a cancelled label is no longer picked).
- **`order_link`** (manual). "Send order link" in the order's More actions opens the Review email
  dialog; `orders.sendOrderLink` writes `order.link_sent` (repeatable) and a timeline line.
- **Order invoice / balance due**: `balance_request` / `balance_reminder` already cover deposit
  pre-orders and edit balances, and `draft_invoice` covers drafts. The gap was a second "Send
  invoice" on a draft doing nothing (`draft.invoice_sent` was not repeatable). It now sends,
  worded as a reminder (`TemplateData.reminder`, set when a draft invoice was sent before).
- **Store credit issued**: skipped. Store credit is a gift card (`refund-routes.ts`
  `store_credit`), and `gift_card_issued` already emails its code.

WhatsApp params (approved template named after the id): `order_edited` / `payment_pending`
{{1}} name {{2}} store {{3}} order {{4}} total {{5}} order link; `shipping_update` {{1}} store
{{2}} order {{3}} AWB {{4}} tracking link; `order_link` {{1}} name {{2}} store {{3}} order {{4}} link.

Every send is logged in `notification` (order, channel, template) by `deliverNotification`, so
it shows on the order timeline and the customer page. No migration.
