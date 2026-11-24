# Checkout and payment choices (owner decisions, 24 Nov 2026)

Four changes on branch `feat/payment-choices-nov24`. Migration `0269_payment_choices` (additive:
`cart_line.sale_ended_from_paise`, `order.checkout_device_id`). The number skips 0267/0268, which
other branches take; renumber at merge if needed.

## 1. A sale that ends while the item is in a cart

- `cart/reprice.ts` `repriceCartLines` brings each cart line to the variant's live price. It runs
  in `getCart` (cart, drawer, checkout) and at the start of `placeOrder`'s `loadCart`, so the
  discount, GST, shipping and the order all use the live price. Lines under a pre-order campaign
  are left to the campaign's own pricing, as before.
- A price that went up keeps what the line was added at in `sale_ended_from_paise`; the cart line
  and the checkout summary show "The sale on this item has ended, so it is now at its regular
  price." (`data/cart.ts`, `data/checkout.ts`). Adding the item again clears the note. A price
  that came down is passed on with no note.
- Any price rise shows this note (the shop has no other kind of scheduled price change).
- Not done: imported Liquid (Shopify) theme carts get the live price but do not show the note.
  The note has no Hindi version (the storefront's checkout words are English plus the merchant's
  own Hindi overrides).

## 2. One-per-customer codes: email or phone

- `customerUsageCount` counts earlier counted uses by the lower-cased email **or** the phone on
  the order that used the code. Indian mobiles match however they were written (`+91`, `0`,
  spaces), using `orderPhoneForms` (the same forms "first-time buyers only" uses). Used by the code
  check, the locked claim at checkout (`claimDiscountUse`) and the over-cap note when a draft is
  paid.

## 3. A cancelled order gives the coupon use back

- `cancelOrder` (every cancel: staff, unpaid expiry, COD link, automations, test-order delete)
  calls the new `uncountOrderDiscountUses`: counted rows become not counted and `used_count`
  goes down by one each. The rows stay, so the code's usage still lists the order.
- Idempotent: `cancelOrder`'s status guard plus the `counted` flag, so a second cancel or a
  cancel after a refund gives nothing back twice.
- Split tender (store credit + gateway) places an order at once, so its code counts at once; when
  the gateway fails and the unpaid order expires, `expireUnpaidOrder` cancels it through
  `cancelOrder`, which now gives the use back.
- `deleteTestOrders` only gives back uses still counted (it used to give a cancelled one back
  twice).

## 4. At most 5 unpaid checkouts an hour

- `unpaidCheckoutsPerHour` now defaults to 5 (was 0 = off). A store that saved its own number,
  including 0, keeps it.
- `recentUnpaidCheckouts` counts per key: by email, by phone and by checkout device. Reaching the
  cap on any one key refuses the checkout (before, the keys were added together).
- Checkout device: a first-party, httpOnly cookie `wc_ckd` (`storefront/lib/checkout-unpaid-cap.ts`),
  set on the first checkout and stored on the order (`order.checkout_device_id`). The per-IP bot
  guard (20 an hour) is unchanged, moved to the same file.
- The refusal is friendlier and has a Hindi version for Hindi-market shoppers
  (`data/checkout-repeat.ts`, `data/hi/checkout-repeat.ts`). Cash on delivery is never counted.

## Tests

- `packages/core/src/cart/reprice.test.ts` (item 1)
- `packages/core/src/discounts/one-per-customer.test.ts` (items 2 and 3)
- `packages/core/src/customers/store-credit-coupon.test.ts` (item 3, split tender)
- `packages/core/src/order/duplicate-checkout.test.ts`, `packages/core/src/payments/settings.test.ts`,
  `apps/storefront/src/lib/checkout-repeat.test.ts` (item 4)
