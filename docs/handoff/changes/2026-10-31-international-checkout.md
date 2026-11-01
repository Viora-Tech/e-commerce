# International checkout (2026-10-31)

Shoppers outside India can check out on the storefront. Owner decision; builds on country
shipping zones (audit #160), Markets (currency, untouched here) and the international courier
apps (DHL Express, FedEx, ShipGlobal).

## What changed

- `packages/core/src/checkout/address-abroad.ts` (new, `@commerce/core/checkout-address`): the
  countries checkout offers (India + every country a shipping zone names; "Rest of world" opens
  all), the loose postcode rule per country, which countries need a region, the phone abroad
  (E.164 via `normalisePhone`), `abroadRegion` and `taxRegimeFor` (`domestic_gst` /
  `export_lut` / `export_igst` from the GST invoices app's `exportMode`).
- `packages/core/src/checkout/regions-abroad.ts` (new): US states, Canadian provinces,
  Australian states by postal code. A listed country's region is stored as its code in
  `address.state_code` (FedEx only sends a 2-letter `stateOrProvinceCode`; ShipGlobal and DHL
  read it too) and its name in `address.province`.
- `placeOrder`: an address abroad skips the PIN code / Indian state check
  (`checkAbroadAddress`), the Delivery options app and the courier estimate; is priced by its
  country zone; COD is refused (`CheckoutRuleViolation('cod_abroad')`); no buyer state for
  discounts or composition routing; GST is zero under a LUT (`order.tax_regime`).
- `validateCheckoutContact` takes the delivery country: abroad any valid phone with a country code.
- Storefront: Country picker in Delivery (only when the store ships abroad, not for gift-card-only
  carts or while editing a saved address); `CheckoutAbroadFields` (address, apartment, city,
  region — a select for US/CA/AU — postcode); international phone input; COD hidden abroad; no
  GST line; shipping quoted by `abroadShipping` (zone rates, transit-day windows when the rate
  has them); drafts and remembered guest details keep the country; the default country is the
  shopper's market country when the store ships there.
- Couriers: `ShipmentAddress.email` (optional) carries the order's email; DHL Express
  (`contactInformation.email`), FedEx (`contact.emailAddress`) and ShipGlobal
  (`customer_shipping_email`, the seller's email as fallback) send it. Order push
  (`order-push.ts`) keeps the ISO country abroad and skips couriers that do not serve the
  destination (`servesDestination`), so Shiprocket/RapidShyp are never sent an export.
- Tests: `packages/core/src/checkout/address-abroad.test.ts` (runs with `bun test`, no DB).
- Docs: merchant guide Checkout › "Shoppers outside India"; Shipping links to it.

## Left out / follow-ups

- Saved addresses (account address book) stay Indian; an address abroad is used for the order
  but not saved. Editing a saved address hides the picker.
- Phone-OTP sign-in (`checkout-otp.ts`) is still Indian mobiles only; stores that require an
  account by phone cannot take a foreign phone sign-in.
- No Hindi overlay for the new strings: the storefront has no `data/hi/` (checkout wording per
  language comes from Settings › Checkout content).
- Order push skips abroad orders without writing a `courier_order` row, so they are re-read each
  run within the 3-day window (harmless, batch-capped at 25).
- Postcode rules are a loose table for ~20 countries; everything else takes 2–10 letters/digits.

## How to test

1. Settings › Shipping: add an area with Countries = United States, Australia (or Rest of world)
   and a rate.
2. Storefront checkout: Country picker appears; pick United States. Fields switch to
   Address / City / State (list) / Postcode; phone accepts `+1 …`; COD disappears; Shipping
   shows the area's rate and "Ships to United States".
3. Wrong postcode (`9410`) → "Enter a valid postcode for this country". Place a prepaid (test
   gateway) order: the order address has `country = US`, `state_code = CA`,
   `province = California`, phone in E.164, `tax_regime = export_lut`, GST 0.
4. Pick India again: PIN code first form, COD and GST line back.
5. Book the order with a DHL/FedEx/ShipGlobal app in Test mode (no real keys needed to inspect
   the payload in unit tests) — the receiver carries country, state code, postcode, phone, email.
