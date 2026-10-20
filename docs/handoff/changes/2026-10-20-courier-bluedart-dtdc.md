# Couriers: Blue Dart and DTDC apps, and labels kept as PDFs

Branch `feat/courier-bluedart-dtdc`. No migration.

## What shipped

- **`packages/shipping-bluedart`** (Blue Dart API Gateway, apigateway.bluedart.com): JWT from
  Client ID + secret (`gateway.ts`, cached per app, minted again on a 401), `Profile` with
  LoginID + licence key on every call. Serviceability (`GetServicesforPincode`, COD from the
  eTail COD flags) with transit days (`GetDomesticTransitTimeForPinCodeandProduct`, failure
  swallowed). Waybill (`GenerateWayBill`: prepaid `SubProductCode P`, COD `C` +
  `CollectableAmount`, pickup registered with the waybill unless switched off, label PDF from
  `AWBPrintContent`). Cancel (`CancelWaybill`), pickup (`RegisterPickup`, needs the Advanced pickup
  address + phone), tracking (`tracking/v1?handler=tnt&action=custawbquery`, polled by the
  worker's shared job). Apex by default, Surface (`E`) behind a switch.
- **`packages/shipping-dtdc`** (Shipsy, dtdcapi.shipsy.io, `api-key` header): booking
  (`consignment/softdata`, COD as `cod_collection_mode: cash` + `cod_amount`), label
  (`shippinglabel/stream`, 4x6 PDF fetched right after booking; a slow label never fails the
  booking), cancel (`consignment/cancel`), tracking (separate DTDC service and login:
  `blktracksvc.dtdc.com` authenticate → `getTrackDetails`), serviceability (DTDC's public
  `PincodeApiCall`). No pickup call (DTDC collects on the account's daily pickup).
- Status mapping for both, NDR wording passed through as scan descriptions (so
  `syncNdrFromTracking` raises NDRs) and RTO mapped to `rto`. Neither offers rates or a
  self-serve webhook, so neither lists `rates`/`webhook`/`ndr`.
- **Every Blue Dart/DTDC wire shape lives in one file per courier** (`src/api.ts`); that is the
  file to correct after a live-account test.
- **Admin**: `/apps/bluedart` and `/apps/dtdc` (overview + connect with Test/Live switch,
  guide, aside, Advanced). Copy in `data/bluedart.ts`, `data/dtdc.ts` with Hindi overlays in
  `data/hi/`; these pages read copy through `useCopy`. Test connection goes through the generic
  `apps.testConnection` (no new `store.test*Connection` procedures).
- Registered in `commerce.config.ts`, root `package.json`, `turbo.json`, the sweeps' package list
  and the secret-fields round trip. Merchant docs: Couriers tabs + App Store rows.

## Contract changes (`@commerce/shipping`)

- `CreateShipmentResult.labelDocument?: { contentType: 'application/pdf', body }` for couriers that
  hand back the PDF, not a link. `createShipmentForOrder` stores it in the store's private storage
  (`packages/core/src/shipping/label-store.ts`, key `stores/<id>/private/shipping-labels/<shipment>.pdf`)
  and sets `labelUrl` to `/api/shipments/<id>/label`, an admin route that calls the new
  `shipments.label` procedure (ORDERS_READ, store-scoped key) and streams it inline. A storage
  failure leaves the shipment without a label rather than rolling back a booked waybill.
  Return pickups (`createReturnPickup`) do not read `labelDocument` yet.
- `ShippingProviderFactory.serviceabilityWithoutCredentials`: DTDC's PIN lookup is public, so
  `testShippingConnection` also runs `verifyCredentials` (a label probe that tells 401/403 from
  "not found", plus the tracking login).

## Verify with a live account (marked `[verify]` in each `src/api.ts`)

- Blue Dart: token endpoint/headers and `{ JWTToken }` answer; every response field name
  (`GenerateWayBillResult.AWBNo/AWBPrintContent`, `GetServicesforPincodeResult` flags,
  `RegisterPickupResult.TokenNumber`, tracking `ShipmentData.Shipment[]`); `SubProductCode` P/C
  and `CollectableAmount`; transit path (`transit/v1` vs `time-finder/v1`) and its `ppinCode`
  field; tracking `StatusType` codes; product codes A/E for the contract; sandbox host.
- DTDC: the whole kit is account-holder only: softdata body/answer, label stream (PDF vs base64
  JSON), cancel body, tracking host/login/answer and date formats, the public PIN code endpoint and
  its fields, service type names.

## Not done

- No storefront "Delivery checker" block for these two (the block is per-app and identical; any
  installed courier's block works).
- No logos in `public/app-logos` (the apps show the fallback tile).
- Open-source check: no maintained adapter to adopt; `nidhiyashwanth/bluedart-mcp-server` (MIT) was
  read for endpoint paths only, no code copied.
