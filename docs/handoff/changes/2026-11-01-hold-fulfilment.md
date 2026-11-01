# Hold fulfilment with a reason (#1011)

- Order page: "Hold fulfilment" in More actions opens a dialog (reason: Awaiting stock, Address
  check, Payment check, Customer request, Other; optional note). A held order shows an "On hold"
  chip and a banner with the reason, who and when, and "Release hold".
- Built on the existing parcel hold (`fulfillment_order.held_at`, used by the automations' Hold
  action). Migration `0216_fulfillment_hold_code` adds `hold_code` and `held_by`.
- Server refuses while held: Fulfil items (`fulfilOrderLines`), Mark as fulfilled / delivered
  (`changeOrderStatus`), plus the existing Create shipment guard.
- Core: `holdOrderByStaff` / `releaseOrderByStaff` (`order/staff-hold.ts`) write a timeline note
  with the staff email and emit `order.fulfillment_held` / `order.fulfillment_released`, which are
  new automation triggers.
- API: `orders.holdFulfillment`, `orders.releaseFulfillment`; `orders.get` returns `hold`;
  `orders.list` rows carry `onHold` and take an `onHold` filter (Fulfilment filter "On hold").
