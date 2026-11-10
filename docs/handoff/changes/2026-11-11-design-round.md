# 11 Nov 2026 design round, built

The owner designed these in Figma (file YmMNC5JOimqg61sI0eFI5a) and asked for all of them in one
release. Each is one commit on `feat/nov11-design-round`.

1. **Variants** (Products): bulk Delete with a confirmation listing the variants; deleted
   combinations stay deleted when options are edited (`reconcileVariants`); one-row bulk bar
   (Set price / MRP / quantity / SKU prefix in small boxes, Generate SKUs for the ticked rows);
   no per-row Generate; the Variants tab takes the full width.
2. **Checkout**: courier logos on delivery cards (`public/courier-logos`, by carrier key);
   insurance is a switch card and its price shows in the Delivery line; the trust lines are one
   card.
3. **Shopper sign-in**: six code boxes over one input, a 30 s resend countdown, a larger card
   and three perks. Order pages unchanged.
4. **Delivery options courier list** (like the owner's Delivery promise Shopify app): an
   option's `couriers.show = 'list'` lists every allowed courier (any speed) as its own card,
   the pick at the option's price and the rest at + the cost difference rounded to ₹…9, one per
   courier and speed, slower-and-dearer hidden, at most N. JSON config, no migration. A shopper
   on a listed faster courier who pays COD books the option's COD route (the Payment step's
   existing note explains it).
5. **Create shipment**: the courier list is a bottom drawer with logos and Ship now; Create
   pickup now after booking. Bulk: an Edit popup per order (courier, ‹ › through the batch);
   Create pickups on the result. Box and weight stay batch-wide in bulk.
6. **Partial shipments**: `splitFulfillmentOrder` + `shipments.splitParcel`; Create shipment's
   "Items in this parcel · ship now" steppers and Ship only these. The rest is a new open parcel
   at the same location (no stock moves); both parcels drop their money shares.
7. **Apps**: an open app's pages list under it in the main sidebar (four, then View more); the
   in-page menu is phone-only. Delivery options has Overview, Options, Routes, Product rules.
8. **Billing**: Change plan is a page (`/settings/billing/plans`) with a Suggested plan and a
   confirm step; "Apps and your plan" shows included, bought and to-buy apps.

Not built: the shipping insurance app (owner: not worth it, each courier's policy differs).

Checked: type checks (core, api, admin, storefront), sweeps, admin/storefront/api suites, core
order/shipping/catalog/billing/apps suites (729 tests).
