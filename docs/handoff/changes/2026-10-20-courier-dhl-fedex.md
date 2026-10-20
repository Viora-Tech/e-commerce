# DHL Express and FedEx (international couriers)

Branch `feat/courier-dhl-fedex`. Two export-only courier apps and the small contract additions
international shipping needed.

## Apps

- `packages/shipping-dhl-express` (MyDHL API, checked against DHL's OpenAPI 3.3.1 file): rates
  (`POST /rates`, INR billing prices, itemised freight/fuel/tax, transit days), shipment with
  label and commercial invoice (`POST /shipments`, pickup requested in the same call), tracking
  (`GET /shipments/{awb}/tracking`), cancel = cancel the pickup (`DELETE /pickups/{dcn}`; MyDHL
  has no AWB void), key test via `GET /address-validate`. Basic auth; Test/Live host switch.
- `packages/shipping-fedex` (FedEx REST): OAuth client-credentials token (cached per project and
  mode), rates with transit times, ship (base64 label + commercial invoice), best-effort pickup
  request after booking, track, cancel. Test/Live host switch.
- Both: `coverage: 'international'`, require an HS code on every line (clear message naming the
  product), declare customs in INR, DAP, no COD, GSTIN from `store.gstin` (DHL: VAT registration
  number; FedEx: `BUSINESS_NATIONAL` TIN), IEC from the app's own field (DHL: exporter id; FedEx:
  printed in the invoice's special instructions). No webhooks: the tracking poll job covers them.
- Admin: `/apps/dhl-express` and `/apps/fedex` (overview + connect), one shared
  `ExportCourierConnectPage` (Test/Live switch, keys, account, origin PIN + city, IEC, pickup
  switch). Copy in `data/dhl-express.ts`, `data/fedex.ts` with Hindi overlays; connect-aside cards.
  `store.testDhlExpressConnection` / `store.testFedexConnection` (the five courier tests now share
  one `courierConnectionTest` builder in `routers/store.ts`).
- Merchant guide: `merchant-guide/apps/international-couriers.mdx`; App store table; developer
  docs plugins page (coverage and documents rules). www app listing entries.

## Contract (`@commerce/shipping`, all optional, domestic couriers unchanged)

- `ShippingProvider.coverage` (`domestic` default | `international` | `both`), capability
  `international`, helpers `servesDestination`, `isDomesticCountry`.
- `RateQuery`/`ServiceabilityQuery`: `destinationCountry`, `destinationCity`; `RateQuery.dimensionsCm`.
- `ShipmentLine`: `hsCode`, `countryOfOrigin`, `sku`, `unitWeightGrams`. `CreateShipmentInput`:
  `dimensionsCm`, `exporterGstin`. `CreateShipmentResult.documents` (base64 PDFs).
- `customsLines`, `missingHsCodeMessage`, `wrapAddressLines`, `indiaLocalTime` in `customs.ts`.

## Core and API

- `compareCourierRates` answers a courier outside its coverage with a `not_serviceable` row and
  no API call; serviceability now gets the destination country and city.
- `primaryShippingProvider` prefers a courier that delivers in India; storefront and
  `estimateForStore` use `domesticShippingProvider` (null when only export couriers are on).
- `createShipmentForOrder` passes HS code (order line first, then variant), origin, SKU, unit
  weight, box and GSTIN; `documents` are joined label-first with pdf-lib and stored at
  `stores/<id>/shipping-labels/<random>.pdf` (`label-documents.ts`). A storage failure leaves
  `labelUrl` null but keeps the booking. `pdf-lib` added to `@commerce/core`.
- Quotes (`quoteShipments`, bulk booking) pass the address's country and city.
- `testShippingConnection` uses `verifyCredentials` for export-only couriers.

## Decisions

- Karrio: LGPL-3.0 outside `ee/` (commercial `LICENSE_EE`), Python service. Ideas only; row in
  `docs/open-source-radar.md`.
- `bun install` re-resolved sharp 0.35.4 → 0.35.5 (patch, now shared with miniflare's pin) in
  `bun.lock` when the new workspace packages were added.

## Not done / follow-ups

- No live account test: every call is checked against the courier's spec and samples, with
  mocked HTTP in tests. Confirm on sandbox keys: DHL product codes for an Indian account, the
  FedEx IEC placement with FedEx India, and FedEx pickup `readyDateTimestamp` handling.
- DDP (shop pays duties), multi-piece parcels, return labels, paperless trade (DHL PLT / FedEx
  ETD) and app logos are not built.
- Core DB tests (`shipments.test.ts`) were not run here (no Docker); pure tests and both
  adapters' suites were.
