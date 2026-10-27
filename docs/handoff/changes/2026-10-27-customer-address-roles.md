# Customer addresses: separate shipping and billing (2026-10-27)

Owner request: the customer page's "Add address" dialog hid shipping vs billing behind two
easy-to-miss checkboxes.

- **Customer page → Addresses card** now shows a **Shipping address** section and a **Billing
  address** section, each with its own add/edit. With no separate billing address the billing
  section reads "Same as shipping address"; a separate one has "Use shipping address" to drop it.
  Other saved addresses follow with "Ship here" / "Bill here".
- **Add/edit dialog** asks "Use this address for" with a segmented Shipping / Billing / Both
  choice instead of the checkboxes. Company name and GSTIN sit in a "Business details" group that
  is highlighted when the address bills. The current shipping address cannot be switched to
  billing-only (pick another shipping address first), matching the API.
- No data model or API change: it maps onto `customer_address.is_default` /
  `is_default_billing`. Role mapping and the book split live in
  `apps/admin/src/components/customers/address-roles.ts` (tested).
- Copy: `apps/admin/src/data/customer-addresses.ts` + Hindi overlay.
