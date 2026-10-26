# Thank-you page redesigned to match the one-page checkout

Branch `feat/thankyou-2026-10-26b`. No migration.

The storefront order confirmation (`app/-s/[storeId]/checkout/thank-you/[number]/page.tsx`,
`components/checkout/thank-you.tsx`) now wears the one-page checkout's look: the same locked
header (with "Continue shopping" where checkout says "Secure checkout"), a tick in the accent,
"Order #1001" and "Thank you, <first name>!", then two white cards on the canvas
(`--ck-card-shadow`).

- **Card 1** says where the order stands. Placed orders: "Your order is confirmed", where updates
  go (the order's email, else phone), the expected delivery window when the parcels have an
  estimate (`deliveryWindow` in `lib/thank-you.ts`), and a Confirmed / Packed / Shipped /
  Delivered bar (`order-progress.tsx`) that follows the real order and latest shipment
  (`thankYouProgress`, folded from the chat's `chatOrderProgress`). Gift-card purchases show the
  email line, no bar. Cancelled / refunded / returning orders say so instead of the bar.
  Open payments keep everything they had, now inside this card: UPI QR, transfer
  instructions, pre-order balance, Retry payment / Get a new UPI QR / Pay now.
- **Card 2** "Order details": Contact, Payment (method · amount paid, "Cash on delivery · ₹X to
  pay", gift cards), Delivering to, Shipping (rate · price), multi-warehouse parcels, then
  "Track your order" and the installed apps' links (GST invoice download, Share and earn).
- **Track your order** goes to the courier's tracking page when a shipment has one, else to
  `/account/orders/<n>` for the signed-in owner; hidden otherwise (guests already land on this
  page from Track order).
- **Summary card** matches checkout: "Order summary · N items", lines with images and quantity,
  rows, and "Includes ₹X GST" under the total when the order carries GST.

Unchanged: data loading, token access and `payToken`, Pixels Purchase, experiment beacon, app
order links. The invoice button keeps the GST app's own label ("Download invoice INV-…").
No WhatsApp claim: delivery of updates by WhatsApp depends on consent and the store's setup.

New: `lib/thank-you.ts` (+ test), `components/checkout/thank-you-card.tsx`,
`components/checkout/order-progress.tsx`; `CheckoutStepsShell` gained an optional `headerEnd`;
`StatusMark` gained a `confirmed` tone.
