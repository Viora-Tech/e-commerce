# Order customer card, contact edits, address book, tracking detection, manual payment details

**Orders, customers and payments fixes** (28 September 2026, `fix/orders-customers-payments`,
**no migration**).

- **Customer card on the order page** (`apps/admin/src/components/orders/customer-card.tsx`):
  Name, Email, Phone, each address line, City, State (full name) and PIN code on their own rows,
  each with an always-visible copy button (`CopyButton` got a `visible` prop and now also shows on
  touch screens). **Copy all** copies name, phone, address, city, state, PIN, one per line.
- **Edit contact from the order** (`edit-order-contact-dialog.tsx`, core `order/contact.ts`
  `updateOrderContact`, route `orders.updateContact`): name, email, phone and shipping address.
  A new `address` row is written and the order repointed (old snapshot kept). Optional "Also
  update the customer's saved address" writes the default book entry. Every change is logged as
  an `order_note` by the staff member. There is no separate billing address column; billing
  still reads "same as shipping".
- **Customer page**: new **Addresses** card (add / edit / delete / default) over the existing
  storefront address book (`accounts/addresses.ts`), routes `customers.addAddress`,
  `updateAddress`, `deleteAddress`; `customers.get` now returns `addresses`. The API checks the
  customer is visible in the store (`customerExists`) before writing, because FKs bypass RLS.
  `?edit=1` opens the edit dialog on arrival; the edit dialog remounts on open so it never shows
  stale data. The address form (`components/customers/address-fields.tsx`) fills city and state
  from the PIN code directory via `customers.lookupPincode` (same loader as Settings → Checkout).
- **Customers list tiles**: the three tiles stretch to the overview chart's height from `xl`
  (checked at 1280, 1440, 1920 and 390 wide).
- **Tracking numbers** (`@commerce/core/tracking-numbers`, pure): courier list with tracking
  pages, format rules with a source per pattern, `detectCourier` (only India Post S10 with check
  digit, Ekart FMP…, Shadowfax SF…, DTDC letter+8 digits are picked; plain digit runs return
  candidates and stay on "Other"). `orders/tracking-fields.tsx` in the fulfil dialog: paste →
  pre-select, "Could be" hints, searchable courier combobox, "Other" with a typed name. Shipment
  `provider` stays the courier's display name, so the tracking poller ignores it as before.
- **Mark as paid details** (`@commerce/core/manual-payments`): method (UPI, bank transfer, cash,
  cheque, other), optional UTR/reference, date received, stored on the captured payment row at
  `checkout_session.collected` (no migration; readers switch on `kind`, untouched). The header's
  "Mark as paid" now opens the same dialog. Timeline shows "Marked as paid: ₹X by UPI".
- **Payments by method** report (finance, `reports/payments.ts`): captured payments by recorded
  method or provider, dated by the received day when recorded.
- **Fix**: `orders.collectPayment` with another store's order id used to insert a payment row
  against it (RLS hid the order, the insert passed); it now returns NOT_FOUND.
- Docs: merchant guide `catalog/orders.mdx` (customer card, edit, tracking table), new
  `catalog/customers.mdx`, `money/payments.mdx` (record how you were paid, Payments by method).

Left for later: a real billing address column if merchants need a different billing address;
confirming courier deep links (only Delhivery and Blue Dart links carry the number).
