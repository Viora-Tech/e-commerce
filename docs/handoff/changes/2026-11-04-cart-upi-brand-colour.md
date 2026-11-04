# Cart: UPI price and brand colours

The cart summary shows "Pay X with UPI, Save Y" through `applyPaymentAdjustment`, the checkout's own
sum, so it rounds the same for any percent, and hides abroad. Its headings read "Cart" and "Order
summary" in capitals. The free shipping bar, discount row, focus ring, delivery result and EMI lines
use `--color-brand`, because `--color-accent` is cyan on Waimers.
