# Settings → Policies and Settings → Checkout

**Settings → Policies and Settings → Checkout** (27 September 2026, `feat/policies-checkout`,
migration `0074_order_buyer_gstin_note`: `order.buyer_gstin`, `order.buyer_business_name`,
`order.customer_note`). Policies are ordinary `page` rows with Shopify's handles
(`refund-policy`, `privacy-policy`, `terms-of-service`, `shipping-policy`,
`contact-information`); "Create from template" fills India-specific text (E-Commerce Rules
2020, DPDP Act 2023) from store details, `store.returns` and shipping rate transit days
(`packages/core/src/policies/`). Legal name and grievance officer live on
`store.preferences.policies` (`grievanceOfficerOf` in `@commerce/core/policies`: reuse it
for the customer-privacy work). Storefront serves `/policies/<handle>` server side; the
footer and checkout list published policies; `/pages/<policy handle>` redirects there; the
link picker stores `/policies/<handle>`. Setup checklist "Policies" = all five published.
Checkout settings live on `store.preferences.checkout` (`@commerce/core/checkout-settings`);
the COD fee stays `store.payments.adjustments.cod`. `placeOrder` runs
`enforceCheckoutRules` (contact incl. GSTIN via `validateGstin`, minimum order, COD limit and
blocked PIN codes) and throws `CheckoutRuleViolation`; the GST invoice defaults its buyer
GSTIN and name from the order. **Open**: the PIN code directory data is not committed:
data.gov.in was unreachable from the building session, so nothing was verified or shipped;
see THIRD_PARTY_NOTICES.md "Pending" and `scripts/build-pincode-directory.ts`. Until the file
exists, autofill is off and shoppers type city and state. The "confirm COD on WhatsApp" flag
is saved but unused. Note: `drizzle-kit generate` numbers new migrations from the journal
entry count (it proposed `0071`), because #183 dropped an entry; write the SQL, snapshot and
journal entry by hand with the next file number, as this PR did. The handoff's "0074 is
reserved for dynamic sources" note conflicts: that follow-up now needs `0075`.

