# Order page names the method the shopper actually paid with

The order header ("Payment: …") and the Next step card read `order.paymentMethod`, the method picked
at checkout. A shopper who picked UPI to your own ID and then paid by Razorpay (#2475) was shown as
"UPI to your own ID — you confirm it". `paidMethod()` in `order-detail-types.ts` now prefers the
captured payment's provider and falls back to the checkout method.
