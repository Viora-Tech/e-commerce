# 2026-10-26 Shipments booking fixes (Delhivery)

Branch `fix/shipments-booking-2026-10-26`. What the owner hit booking a Delhivery shipment on Waimers.

## 1. Courier rates no longer re-fetched on every keystroke

- `apps/admin/src/components/shipments/create-shipment/quote-ask.ts` (pure, tested): `quoteAsk`
  decides when the couriers may be asked (weight, COD amount, and either no box size or a full
  one) and gives each request a key, so equal values ("150" and "150.0") never ask twice.
  `debouncedAsk` waits 600 ms after the last change and drops a stale answer.
- `use-ship-quote.ts` asks only when the key changes, aborts the request in flight
  (oRPC `{ signal }`) when the package changes again, keeps the old prices on screen dimmed
  under "Updating prices…" (or "Finish the box size…"), and Book waits for current prices.

## 2. Booked shipment shows read-only details

- New `components/shipments/shipment-details.tsx`: courier/service, AWB with a visible copy
  button, status, Prepaid/COD + amount, weight and size, pickup ("Pickup requested for …" or
  "Request pickup"), pickup location, booked time, Track, Print label, Cancel shipment (centred
  confirm). `shipment-details-loader.tsx` loads it by id.
- Create shipment page: once booked the route/package/courier/pickup cards are replaced by the
  details card. Order page `shipment-panel.tsx` uses the same view (its Cancel used to fire
  with no confirm). Shipments list ⋯ menu has "Shipment details" (centred dialog).
- AWB copy buttons added in NDR tab, pickups tab, bulk done step; made always visible on
  India Post parcels and the done step.
- New columns on `shipment` (migration `0173_shipment_booking_details`): `payment_mode`,
  `cod_amount_paise`, `pickup_location_name`, `service_label`; and `shipment_pickup.pickup_location_name`.
  Older rows simply show fewer facts.

## 3. Cancel shipment

- Delhivery `cancel` now sends the documented JSON body `{ waybill, cancellation: "true" }`
  and treats `status: false` as a refusal with Delhivery's remark (`label-pickup.ts`).
- Core `shipping/shipment-cancel.ts`: `cancelShipment` refuses (before calling the courier)
  once picked up/in transit, delivered/RTO, already cancelled, on a manifest, or when the
  courier app does not declare `cancel` (Shiprocket) — `cancelBlock` in `shipment-state.ts`
  (pure subpath `@commerce/core/shipment-state`). Writes an order timeline note with the
  staff email. Error → `PRECONDITION_FAILED` with `data.block`.
- Re-booking: the cancelled parcel stays packed (it is in the box), so `rebookableParcels`
  lets `shipments.prepare` and `createShipmentForOrder` book its packed units again, and the
  To book tab lists a packed order whose only labels are cancelled.
- `shipments.get` (new, ORDERS_READ) and `orders.get`'s `shipment` carry `cancelBlock`,
  `canRequestPickup`, `providerLabel`, the pickup, and a safe `labelUrl`.

## 4. Print label 401

- Delhivery no longer stores `…/api/p/packing_slip?…` as `labelUrl`; booking sets
  `labelViaProvider` and the row points at `/api/shipments/<id>/label`.
- `shipments.label` (`shipmentLabelFile`) serves the stored PDF, else asks the adapter's new
  `getLabel` server-side with the saved token (packing slip `pdf=true` → `pdf_download_link`,
  or inline `pdf_encoding`). The token never reaches the browser.
- Old rows: `shipmentLabelUrl` rewrites a stored Delhivery packing-slip link to the route at
  read time (orders.get, shipments.get, shipments.list). No data migration.
- The admin route answers 502 with our message when the courier can't hand the label over.

## 5. Pickup location name

- No read-only way exists: Delhivery's B2C API reference lists only Client Warehouse
  *Creation* and *Edit* (both write) — nothing lists or fetches warehouses. Not called.
- Booking errors now carry `CourierError.detail = { code: 'no_pickup_location', pickupLocationName }`;
  the Create shipment page shows `NoPickupLocationAlert` with the exact name sent (copyable)
  and links to Delhivery One, Delhivery's pickup-locations help, and Apps → Delhivery → Connect.
  The Connect page's test-connection hint says why it can't check the name.

## 6. Pickup date default

- `startingPickupPlan`: today before 12:00 Asia/Kolkata, tomorrow from 12:00. Today stays pickable.

## Extra: shipments stuck in Delhivery "Ready to Ship"

- Cause: the pickup request named Settings › Shipping's warehouse name (e.g. "Waimers HQ"),
  not the Delhivery pickup location the booking used; Delhivery answers that with HTTP 401
  "ClientWarehouse matching query does not exist", which was read as a bad token, recorded as a
  failed pickup, and the admin still said "Pickup requested". Also `pickup_time` was "14:00",
  Delhivery wants "hh:mm:ss".
- Now: the request names the place the booking used (`shipment.pickup_location_name`, else
  the location's courier pickup name, else the courier's `defaultPickupLocationName`); one
  request per courier + place + day (a later booking joins the open request and bumps its count;
  `pr_exist`/"already exists" counts as done); a refused request is reported, never shown as
  requested, and the details view offers "Request pickup". Bulk booking requests the pickup
  right after booking (starting day), once per place.

## Verify

`bunx tsc --noEmit` (admin, worker, core, api, shipping, shipping-delhivery), `bun run lint`
(0 errors), core + api DB tests (`TEST_DB_NAMESPACE=ship26 TEST_WORKERS=2`), Delhivery client
tests (mocked fetch), admin create-shipment tests, sweeps (only `site-config` fails, on
`data/whatsapp-signup.ts` from dev, not this branch). No live Delhivery call was made.
Delhivery has no Hindi overlay for its Connect page copy (existing gap; only the English hint changed).
