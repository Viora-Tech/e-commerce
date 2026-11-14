# RapidShyp: a picked courier never makes a second copy of the order

Booking a picked courier (e.g. Blue Dart) on RapidShyp only creates the order there; the merchant
assigns the courier on RapidShyp's panel. A second click used to try `2473-2`, `2473-3`, ... and,
after four ids, show "Cancel or delete it on RapidShyp, then book again here", which left stray
copies and gave the wrong advice. Now the picked-courier path sends one id; if RapidShyp already
holds it, staff see "Order 2473 is already on RapidShyp from an earlier booking. Open order 2473
in RapidShyp and assign Blue Dart Air there, then add its AWB here with Ship › Shipped yourself."
The wrapper (no courier picked) and pending-order push still move to the next suffix.
Code: `packages/shipping-rapidshyp/src/booking.ts` (`bookChosen`, `alreadyThere`).
