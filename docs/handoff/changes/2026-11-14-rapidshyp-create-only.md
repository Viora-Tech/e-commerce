# RapidShyp: a picked courier leaves the order for the merchant to assign

- RapidShyp's documented API cannot put a chosen courier on a new order: create_order returns
  `shipment: []`, and Track Order says "Tracking data not found" until an AWB exists (seen with
  2471-2, -3 and -4 on 14 Nov 2026).
- Owner, 14 Nov: "create only the order when I click Blue Dart; I assign the courier in
  RapidShyp". `bookChosen` now keeps the order on RapidShyp (no cancel) and tells staff: "Order
  2471-5 is now on RapidShyp without a courier… assign Blue Dart Air there, then add its AWB here
  with Ship › Shipped yourself." RapidShyp's answers ride on `reason` for the log.
- One quick Track Order round instead of three (about 4.5 s less).
- Not yet: picking up the AWB booked on RapidShyp automatically. Booking again from Koomerce makes
  another RapidShyp order (2471-6).
