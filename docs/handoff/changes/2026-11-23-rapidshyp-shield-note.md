# RapidShyp Shield note on the insurance switch

RapidShyp support (23 Nov): Shield is one account setting and applies to every booking when it is on; the API has no per-parcel switch, and the charge shows in RapidShyp wallet transactions.

So when the picked courier is RapidShyp, the courier drawer and the bulk edit panel show a line under the Shipping insurance switch: "RapidShyp Shield follows your RapidShyp settings. This switch does not turn it on or off." The switch stays (owner, 22 Nov: do not hide it). Copy in `data/create-shipment.ts` and `data/bulk-ship.ts`, Hindi overlay included.

Update (later 23 Nov): RapidShyp support added that Shield insures every order, wrapper or create_order, whose value is above the amount set in the merchant's RapidShield settings (₹2,500 for Waimers). The note now says that. Their label example (`POST generate_label` with `{"shipmentId": ["..."]}`) matches what `getLabel` sends (626cd3ea3).
