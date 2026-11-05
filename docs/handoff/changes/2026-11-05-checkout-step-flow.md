# Checkout goes step by step, from the Figma design

The agreed design is the Figma page "Checkout · Polish" (node 856:15471). Contact, Delivery,
Shipping and Payment now show one at a time, inside the one form: hidden steps stay mounted, so
every field goes with the order and `placeOrder` is unchanged. `useCheckoutForm` keeps the step;
until a shopper touches a field it follows the first unfinished step, so a returning shopper lands
further on. `checkout-stepper.tsx` moves the long line with the current step, `checkout-review.tsx`
shows finished steps with Change, Pay sits in the summary and waits for the last step, and a phone's
bottom bar carries Continue, then Pay. Default checkout font is Plus Jakarta Sans again, the
admin's real font. Payment rows, the copyable transfer details and the UPI QR card are next.

## Result pages, sold out, country search (same PR)

- `thank-you.tsx` now follows the Checkout · Polish result frames: status line, order number card, Delivery card with the one-line progress, Order details (contact, payment, parcels, app links), actions. New parts: `thank-you-confirming.tsx` (polls every 5 s through `thank-you-refresh.tsx`), `thank-you-failed.tsx`, `thank-you-delivery.tsx`, `thank-you-rows.tsx`.
- `transfer-instructions.tsx` has Copy buttons (`copy-button.tsx`). Transfer and UPI QR copy moved to `data/checkout-payment.ts`, still re-exported from `data/checkout.ts`.
- `checkout-sold-out.tsx`: a line with `available < 1` (not pre-order, not gift card) holds the steps and locks Pay until it is removed. "Notify me" uses the back-in-stock list with the contact already entered.
- `checkout-country-select.tsx`: searchable Country field. Flags are the `country-flag-icons` 3x2 SVGs copied to `apps/storefront/public/flags`, so `flags/` is excluded from the proxy matcher.
- Checkout shadow tokens are in rem. New tokens: `--ck-warn`, `success-soft`, `warn-soft`.
- Not built, on purpose: inline gateway tabs and QR on Payment (Razorpay keeps its own window), Choose a delivery day, Account ready, Pay another way, payment failure reason, holding timer.
