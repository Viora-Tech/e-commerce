# India Post courier app (Speed Post, counter booking)

Branch `feat/courier-india-post`. No migration.

## What it is

`packages/shipping-indiapost` (plugin id and provider id `india-post`), listed in
`commerce.config.ts`. India Post has no public booking or tracking API (its booking API is for
contracted bulk customers, onboarded through India Post's Business Development team; nothing
public to code against), so:

| Part | How |
| --- | --- |
| PIN codes | data.gov.in's All India Pincode Directory API with the merchant's own free key (post offices, district, state), else the bundled directory file when installed, else the PIN digits. GODL-India. `src/pin-directory.ts` |
| Zones + transit | Local / within state / metro / other states, plus our `special` row (NE, J&K, Ladakh, islands; charged as other states). Transit from India Post's published service standards, +1 day for branch-office delivery. `src/zones.ts` |
| Rates | Speed Post Parcel tariff effective 01.08.2026 (S.O. 4241 (E)), retail and contractual cards, + ₹5 registration, + merchant COD fee, + 18 % GST. Merchant can paste their own card (JSON). `src/data/speed-post-parcel-tariff.ts`, `src/tariff.ts` |
| Booking | Manual: the merchant types the article number from the counter receipt in Create shipment; UPU S10 format + check digit checked on the server. `src/article-number.ts` |
| Label | Our 4 × 6 in PDF with Code 128 (`@commerce/invoices/barcode`, newly exported), COD amount, both addresses. `src/label.tsx`, served by `shipments.indiaPostLabel` at the app page `/apps/india-post/labels/<number>` (the shipment's `labelUrl`) |
| Tracking | Manual: Apps → India Post lists open parcels with a status select and a link to indiapost.gov.in (its tracker takes no number in the URL). We do not scrape the public tracker. |
| COD | Only when the merchant turns it on (business account); collectable amount stored in `shipment.provider_ref` (`svc=…;cod=<paise>`) and printed on the label |

## Shared changes (small, additive)

- Contract (`packages/shipping/src/types.ts`): `CreateShipmentInput.trackingNumber?`,
  `CreateShipmentResult.trackingUrl?`, `ShippingProvider.requiresTrackingNumber?` and
  `tracksManually?`.
- Core: `CreateShipmentOptions.trackingNumber` passed through; booking stores the result's
  `trackingUrl`; `CourierRateRow.needsTrackingNumber`; new `recordManualTracking`
  (`shipping/manual-tracking.ts`) appends an event and runs `applyTracking`.
- Worker: the tracking poll skips `tracksManually` couriers.
- API: `orders.createShipment` takes `trackingNumber`; new `shipments.recordStatus`
  (ORDERS_FULFIL) and `shipments.indiaPostLabel` (ORDERS_READ); service
  `services/india-post.service.ts`.
- Admin: Create shipment shows an "Article number" box when the picked row needs one (single
  dialog and full page; bulk booking of India Post fails per order with the message);
  `CourierConnectAside.pickupKey` is optional. India Post app pages under
  `components/apps/india-post/`, copy in `data/india-post.ts` + `data/hi/india-post.ts`.
- Docs: merchant guide `apps/india-post.mdx`, developer docs plugins rules, radar rows, notices.

## Left undone

- The cross-store leak test and DB tests were not run (no docker); `shipments.recordStatus` and
  `shipments.indiaPostLabel` are new procedures it will walk.
- No India Post logo (a red tile); no storefront change beyond the shipment's tracking link.
- Bulk booking cannot take article numbers yet.
- If India Post opens its tracking or booking API to small merchants, replace `track()` and the
  manual booking in `src/india-post.ts`.
