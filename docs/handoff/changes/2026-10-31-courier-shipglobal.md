# ShipGlobal (international courier app)

Branch `agent/shipglobal`, pushed to `dev`. An export-only courier app for ShipGlobal
(shipglobal.in), the Indian cross-border aggregator Waimers used on Shopify. Built on the
international courier contract from `2026-10-20-courier-dhl-fedex.md`.

## What the API docs give us

ShipGlobal publishes one API: the **Label Generation API**,
https://labels.shipglobal.in/api-docs.php (read 2026-10-31). It documents:

- `POST /api/v1/customers.php` — `{email, password}` → `{token, expires_at, customer}`.
- `POST /api/v1/addOrder.php` — Bearer token; invoice, package (grams, cm), seller, customer and
  `vendor_order_items` (name, SKU, qty, unit price, HSN, tax rate) → `{success, label, error,
  data: {order_number, waybill_number, pdf_base64, label_format}}`. Failures still answer HTTP
  200 with `success: false`. A repeated `order_reference` + `invoice_no` returns 409, or the saved
  label with `?download=true`.
- Service codes: DPD, UNIUNI, VIPPARCEL (needs `mailClass`, `deliveryConfirmation`), DHLECS, UBI,
  USPS (US only, ≤ 5000 g), UPS (US only, > 5000 g, label is a GIF).
- `POST /processDestination.php` — manifest handoff, UBI only, for carrier partners. Not used.

Not documented anywhere public: rates, tracking, cancel, pickup, webhooks, a sandbox host. The
merchant dashboard (v2.app.shipglobal.in) has **Settings › API** with an "API login and
password" (per the Base.com integration guide,
https://base.com/en-EN/help/knowledgebase/shipglobal-india-integration-base/), and Base shows a
"real-time price calculator", so a fuller merchant API likely exists but is not public.

## Built

- `packages/shipping-shipglobal`: `client.ts` (host, tracker URL, services, capabilities),
  `mapping.ts` (service choice with the USPS/UPS weight split, token lifetime, name/phone/street
  mapping), `shipglobal.ts` (provider), `factory.ts`, `plugin.ts`. Capabilities:
  `serviceability`, `create_shipment`, `label`, `international`. `coverage: 'international'`, no
  COD, DAP, HS code required on every line (`missingHsCodeMessage`), GSTIN from the store, IEC and
  IOSS from the app's fields. Token cached in memory (`LoginTokenCache`), one re-login on 401.
  `?download=true` makes a retried booking return the same label; `order_reference` is the order
  UUID so a ShipGlobal account also used from Shopify (overlapping order numbers) can never hand
  back that store's label.
- No rates: the rate table shows ShipGlobal as "rate on booking" abroad and "Ships from India to
  other countries only" at home (new test in `courier-rates.test.ts`). No tracking:
  `tracksManually`, so the poll job skips it; the app page lists open parcels with a status
  control. No cancel: not in capabilities; the merchant cancels in ShipGlobal's panel.
- Admin: `/apps/shipglobal` (overview + parcels) and `/apps/shipglobal/connect`.
  `ExportCourierConnectPage` gained optional `accountField`, `extraFields`, `extraValues`, and
  `mode`/`pickup` copy became optional (no Test/Live or pickup switch for ShipGlobal; DHL and
  FedEx unchanged). India Post's parcels card moved to `shared/manual-parcels-card.tsx` +
  `shared/manual-parcel-row.tsx` (copy and tracker passed in) and both apps use it.
  `store.testShipglobalConnection` (shared `courierConnectionTest`), registry entry, copy in
  `data/shipglobal.ts` + `data/hi/shipglobal.ts`, connect-aside cards (en + hi).
- Catalogue regenerated, merchant guide (`international-couriers.mdx`, `app-store.mdx`,
  `couriers.mdx`), developer plugins page, sweeps lists, turbo, root and admin package.json.
- `delivery-options/routes.ts`: "ShipGlobal" carrier name match. The Shopify importer maps no
  couriers or fulfilment services by name, so nothing to add there.

## VERIFY with ShipGlobal support (all marked `// VERIFY:` in code)

1. Does a merchant account from app.shipglobal.in sign in to `labels.shipglobal.in/api/v1`, or is
   there a different merchant API host (and a sandbox)?
2. Is there a rate, tracking, cancel or pickup API for merchants? If yes, add `quoteOptions`,
   `track` (drop `tracksManually`) and `cancel`.
3. Token lifetime and the zone of `expires_at` (read as IST, 1 h fallback); the status for a bad
   or lapsed token (401/403 assumed); the body for a wrong password (no `token` = refused).
4. `seller_nickname`: what it should hold (we send the Connect page's "Seller nickname").
5. `currency_code`: we send `INR` (the docs' sample is EUR).
6. `csb5_status`: we send `1`, read as "export under CSB-V".
7. `seller_tax_id_type` for an Indian GSTIN: we send `GSTIN` (sample says `VAT`).
8. IEC: the docs have no field; we send `iec_number`.
9. `vendor_order_item_tax_rate`: we send `0` (zero-rated export under LUT); or the IGST rate?
10. `tracking` (mandatory, undescribed): we send the merchant's tracking number if any, else the
    order UUID.
11. `seller_email` / `customer_shipping_email`: the shopper's email is not in the shipment
    contract, so both carry the API login email.
12. Max length of `order_reference` (UUID, 36 chars) and of address lines (cut at 50).
13. Blank `seller_address_2` / `customer_shipping_address_2` / state accepted? We fill the city.
14. Which services serve which countries (only USPS/UPS have a documented rule); the default
    service is DHLECS.
15. Tracking page URL format with a number (we link `shipglobal.in/tracking/`).

## How the owner connects and tests

Apps → install **ShipGlobal** → Connect: API login (email) and password from ShipGlobal ›
Settings › API, seller nickname, origin PIN and city, IEC, IOSS (optional), service → **Test
connection** (only signs in, books nothing) → Save. Every booking is real (no sandbox), so test
with one cheap export order, check the label PDF, then confirm the VERIFY list with ShipGlobal.

## Not done

- No live call was made; no checks run (owner rule). Tests use fixtures shaped from the docs.
- UPS GIF labels are not stored (labels are joined as PDFs); print them from ShipGlobal.
- No logo in `app-logos/`.
