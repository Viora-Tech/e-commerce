# Orders "ready to ship" count includes packed orders whose labels were all cancelled

Owner, 15 Nov 2026: the Orders pill said 53 while Shipments › To book said 55. To book lists a
packed order again when every label it had was cancelled (#2464); the Orders count did not.
`readyToShipWhere` in `packages/api/src/services/order-list-page.service.ts` now counts them too
(pill and the Ready to ship tile). The two numbers can still differ by design when one order ships
in two parcels (To book counts parcels, Orders counts orders).
