# Separate billing and shipping addresses (draft orders + customer address book)

Branch `feat/billing-shipping-address-2026-10-26`, fixes #816.

## Migration `0175_billing_address` (additive)

- `order.billing_address_id uuid null → address(id)`. Null = billing is the shipping address
  (every checkout order, every existing order).
- `customer_address.is_default_billing boolean not null default false` (+ partial unique index
  `customer_address_one_default_billing`: at most one per customer), `business_name text null`,
  `gstin text null`.
- No backfill. `is_default` keeps meaning "default shipping", so the storefront account book and
  checkout are unchanged.

## What changed

- **Core** `accounts/addresses.ts`: `SavedAddress` carries `isDefaultBilling`, `businessName`,
  `gstin`; `createAddress`/`updateAddress` accept them (left out = keep, so the storefront form
  never clears them); new `setDefaultBillingAddress`. No billing default = billing follows the
  shipping default. `AddressInputSchema` validates the GSTIN with `validateGstin`
  (`OptionalGstinSchema`). `GSTIN_MESSAGES` moved to `tax/gstin.ts` (re-exported from checkout settings).
- **Core** `order/draft-billing.ts` (new, split from `drafts.ts`): `DraftInput` takes
  `billingSameAsShipping` and `billing` (address + `businessName` + `gstin`). Same-as-shipping
  clears `billing_address_id`, `buyer_gstin`, `buyer_business_name`; a billing address writes a
  snapshot and sets the buyer GSTIN/company (refused with `DraftInvalidGstin` when the GSTIN fails
  the check); neither leaves an edit's billing as it was. Duplicate order copies the billing address.
  Erasure (`anonymiseCustomer`) treats the billing snapshot like the shipping one.
- **GST invoices** `plugin-gst-invoices/src/issue.ts`: buyer = billing address when the order has
  one, ship-to prints the delivery address. **Place of supply stays the delivery (shipping) state**,
  exactly as checkout and the order's tax at conversion (`convertDraft` → `taxParcels` with the
  shipping state). Owner/CA follow-up if wanted: IGST Act s.10(1)(b) bill-to-ship-to case (a
  third party directing delivery) would put the place of supply at the billing party's state;
  not done, because the order's tax is already computed from the shipping state.
- **API**: `customers.addAddress/updateAddress` take the new fields; new
  `customers.setDefaultBillingAddress` (`customers:write`). `orders.get` and `orders.getDraft`
  return `billingAddress` (null when the same). MCP action docs regenerated.
- **Admin**: draft editor has a Billing address card ("Billing address is the same as shipping",
  ticked by default; unticked shows name, company, GSTIN with inline check, address, PIN, city,
  state, phone). Picking a customer fills shipping from their default shipping address and billing
  from their default billing one. Convert is blocked until an unticked billing address is complete.
  Customer page Addresses card: "Default shipping" / "Default billing" chips, "Set as default
  billing", company + GSTIN on the card; the Add/Edit dialog has both default checkboxes and
  company/GSTIN fields. Order page Customer card shows the billing address when it differs.
  Copy: `data/customer-addresses.ts` (moved out of `customers.ts`), `data/drafts.ts`,
  `data/order-detail.ts`, Hindi overlays for all.

## Not done

- The placed-order "Edit contact" dialog and the order edit page still edit only the shipping
  address; billing on a placed order is set from the draft only.
- Storefront checkout still has no separate billing address (its "Get a GST invoice" fields are
  unchanged).

## Tests

Core (`TEST_DB_NAMESPACE=bill26 TEST_WORKERS=2`): `order/drafts.test.ts` (separate billing +
GSTIN, tax from shipping state, same-as-shipping clears, bad GSTIN refused),
`accounts/accounts.test.ts` (default billing alongside shipping, keep-on-omit, fallback).
GST plugin: `test/issue.test.ts` (bill-to vs ship-to, place of supply = delivery state).
