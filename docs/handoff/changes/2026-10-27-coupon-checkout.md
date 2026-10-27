# Coupon codes at checkout (owner test, 27 Oct)

1. **Code typed in the cart, then Checkout: not applied.** The cart's field only kept a code on
   Apply/Enter. `CartCheckoutLink` sends a typed, unapplied code along as
   `/checkout/start?discount=`, and the route applies it (`applyDiscountAction`, same rate limit).
   A theme's own `discount` field can use the same parameter.
2. **Code typed at checkout, then Pay: Razorpay asked for the full price.** Two causes:
   - typed but never applied: Pay (and Express UPI) now apply it first and ask the shopper to
     check the new total (`applyTypedCode` in `use-checkout-form.ts`, `data-pending-code`);
   - applied, but not valid for this contact (one use per customer, customers only): the
     summary cannot know before the email, and `placeOrder` used to drop the code silently and
     charge full price. It now throws `DiscountCodeRefused`; checkout says which code and why
     and places nothing; a draft conversion says so too. Test updated: a used-up code is refused,
     not charged full price.
