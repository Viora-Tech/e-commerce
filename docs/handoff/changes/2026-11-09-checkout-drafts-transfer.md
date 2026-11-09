# Checkout drafts, part 5: UPI / bank transfer "order received" page

Owner: shoppers paying by UPI to the shop or bank transfer were not sure their order registered.
The existing transfer page (thank-you page with `TransferInstructions`: QR, UPI ID, amount, bank
details) is kept as it was, and "Place order" with a transfer already lands on it. On a transfer
checkout kept as a draft it now has every state:

- **Waiting**: heading "Thank you! Your order #D57 is received", line "Complete your payment to
  confirm it.", the same QR / UPI ID / amount / bank card, "Or pay online" when the store has a
  gateway (`payOnlineInstead` now works on an open checkout draft), and a new "Paid already?"
  card with an optional "UTR or reference" field and an "I've paid" button.
- **"I've paid" sent** (`shopperPaidAction` → core `recordShopperPaid`): kept on the open
  transfer attempt (`checkout_session.shopperPaid`: UTR and time, read with
  `@commerce/core/shopper-paid`), a timeline note "Shopper says they paid … UTR / reference: …",
  `last_activity_at` bumped. Once per attempt, rate-limited like "Retry payment". The page then
  shows "Thanks, we are checking your payment" with the reference. Admin: the Drafts list chip
  "Shopper says paid", the note on the checkout draft's timeline. Nothing is marked paid.
- **Paid / confirmed**: the merchant's "Mark as paid" converts it (part 4); the page then shows
  the normal confirmed order with its real number and the usual confirmation goes out.
- **Expired** (7 days without activity): "This checkout has expired" with what to do; no QR.
- **Message**: new `transfer_requested` email / WhatsApp ("Order #D57 received, complete your
  payment", with the payment details and the page link), from the outbox event
  `order.transfer_requested` written when a transfer draft is made; delivered only while it is an
  open checkout draft. WhatsApp needs a Meta template named `transfer_requested` (params: name,
  store, #D57, amount, link), like `payment_reminder`.
- The transfer reference (UPI note) of a draft is "Order D57" (`ManualPaymentProvider`), and
  WhatsApp params quote `D57` for drafts.
- Hindi: admin strings (notification name, list chip). The storefront and customer messages have
  no Hindi layer yet, so their new copy is English like the rest of the checkout.
