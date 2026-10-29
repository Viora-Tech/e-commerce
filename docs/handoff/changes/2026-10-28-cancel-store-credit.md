# Cancel order: store credit, honest timeline, no balance on a refunded order (#899)

From live order #2371 (₹1 Razorpay, cancelled 28 Oct): the tester cancelled with "No refund",
then gave the ₹1 back as store credit from the payment card; the timeline said "Nothing to
refund"; afterwards the order read ₹1 due.

- **Store credit on cancel.** `REFUND_ROUTES` gains `store_credit`
  (`packages/core/src/order/refund-routes.ts`): `refundOrderAmount` issues one gift card for the
  amount to the order's shopper (`issueGiftCard`, the settings secret passed as `storeCredit`)
  and records each payment's share as a `store_credit` refund on that card, `refund.created` as
  usual. `cancelOrderByStaff` takes `settingsSecret`; `orders.cancel` passes it. The admin's
  shared `RefundRouteField` shows "Store credit" when `storeCredit` is set: on Cancel order only.
  Order edit keeps original / by hand / none (`orders.edit` refuses `store_credit`).
- **Timeline.** "Nothing to refund." only when nothing was taken; choosing No refund with money
  taken now reads "Not refunded: ₹1.00 left to refund."; store credit reads "… given back as
  store credit."
- **Balance.** `orderBalance` (`packages/api/src/services/order-fulfil.service.ts`) counts a
  `refunded` payment as received (its refunds are `refundedPaise`), so a cancelled, fully
  refunded order owes nothing.
- Inventory on #2371 was fine: restocked, 15 on hand / 0 committed / 15 available.

Tests: core `order/edit.test.ts` (store credit: one card, one refund, no gateway call; the No
refund wording), api `test/order-balance.test.ts` (refunded in full owes nothing; nothing taken
owes the total; paid owes nothing). Typecheck core, api, admin.
