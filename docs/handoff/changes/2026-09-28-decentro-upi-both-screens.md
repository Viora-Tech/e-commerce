# Decentro: one UPI session for computers and phones (PR #217)

- Decentro's QR API returns a link to its own web page, not an image, so the QR never showed.
  The adapter now always calls the payment link API (`generate_psp_uri: true`) and returns a
  `upi_qr` session with `upiUri` plus app links (`apps`: gpay, phonepe, paytm, cred). The
  storefront draws the QR from `upiUri` when there is no `imageUrl`, and shows app buttons on
  phones (`manual-pay__open` hides them on desktop). The `flow` setting is gone; saved values
  are ignored.
- `syncOpenQrAttempt` (core, payments/attempts.ts): asks the gateway about an open QR and
  records only a capture. The QR page calls `checkQrPaymentAction` every 15 s and on
  "I've paid" (8/min per order), so orders turn paid even without the callback.
- Admin connect page: callback URL, header name and secret moved out of Advanced into
  "Payment updates"; Advanced keeps only the payouts URN.
