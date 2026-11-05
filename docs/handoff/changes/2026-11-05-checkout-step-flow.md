# Checkout goes step by step, from the Figma design

The agreed design is the Figma page "Checkout · Polish" (node 856:15471). Contact, Delivery,
Shipping and Payment now show one at a time, inside the one form: hidden steps stay mounted, so
every field goes with the order and `placeOrder` is unchanged. `useCheckoutForm` keeps the step;
until a shopper touches a field it follows the first unfinished step, so a returning shopper lands
further on. `checkout-stepper.tsx` moves the long line with the current step, `checkout-review.tsx`
shows finished steps with Change, Pay sits in the summary and waits for the last step, and a phone's
bottom bar carries Continue, then Pay. Default checkout font is Plus Jakarta Sans again, the
admin's real font. Payment rows, the copyable transfer details and the UPI QR card are next.
