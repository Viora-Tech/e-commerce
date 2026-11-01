# Settings → Payments as a row list (31 Oct 2026)

Owner request, after #150: Settings → Payments uses the same row list and detail pattern as
Settings → Checkout (`settings-drill.tsx` / `settings-drill-panel.tsx`, `?open=` in the URL,
old `#anchors` open the row of that id).

- Rows (`components/payments/payments-rows.ts`, `PAYMENT_ROWS`), each with its current value:
  `providers` (main gateway card, other gateways, ActiveProvidersCard, Razorpay websites card,
  Add another way to get paid, the setup guide), `methods` ("Shoppers can pay with" +
  RouteMethodsCard), `manual` (ManualMethodsCard), `capture` (PaymentCaptureCard, shown with a
  gateway), `rules` (PaymentRulesCard, titled "Payment method customizations") and `more`
  (the old Advanced: UPI options and the link to `/settings/payments/advanced`; the out-of-date
  "payments are always captured at once" note is gone).
- Status, test-mode and Razorpay website banners stay above the rows. The website banner now
  links to `?view=page&open=providers#razorpay-websites` (`listHref`).
- Settings search: UPI → `?open=methods`, cash on delivery → `?open=manual`, payment companies →
  `?open=providers`; new entries for Payment method customizations and Payment capture.
- Copy: `paymentRulesContent.page` (+ Hindi). Merchant guide `settings/payments.mdx` describes
  the rows.
- Unchanged: the setup wizard, connect flows, Live/Test keys, Active/Inactive, routing, manual
  methods, the Advanced page itself.
