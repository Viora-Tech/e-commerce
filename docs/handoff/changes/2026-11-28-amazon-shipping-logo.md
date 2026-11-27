# Amazon Shipping logo on courier cards

Branch `fix/amazon-shipping-logo`. Checkout showed Amazon Shipping as an "AS" initials tile
while Delhivery, Ekart and Blue Dart showed logos (owner, 28 Nov 2026).

- New mark: `apps/storefront/public/courier-logos/amazon.svg` and the same file as
  `apps/admin/public/app-logos/amazon-shipping.svg`. A 24 x 24 single-colour-style mark like
  `dhl.svg` and `fedex.svg`: a dark lowercase "a" over an orange smile arrow, drawn with paths
  (no font), on the white tile (`light: true`).
- Storefront: `COURIER_LOGOS.amazon` in `apps/storefront/src/lib/delivery-cards.ts` (carrier key
  `amazon` from `normaliseCarrier`). This covers the checkout courier list, option cards and
  the COD line (`courier-list.tsx`, `option-card.tsx`, `payment-methods.tsx`).
- Admin: `/amazon/i` in `apps/admin/src/components/shipments/create-shipment/courier-logo.ts`,
  read by `CourierMark`: Try a PIN and the courier list preview (`checkout-preview-list.tsx`),
  the Options page courier switches, the route table, and the Create shipment and bulk ship
  courier rows.
- Emails and WhatsApp messages use no courier logos, so nothing changed there.
- No tests assert a logo file; nothing else to run. Check on localhost: checkout at a PIN
  Amazon Shipping serves, and Try a PIN.
