# Draft orders: picking a customer fills the phone and the right state (#1028)

Picking a customer on a draft filled name, email and address, but left **Phone** empty when the
customer had no contact phone, and the **State** could show Haryana for a Thane address.

- **Phone:** the contact phone, else the mobile on their latest order or saved address
  (`customers.get` → `phoneSuggestion`, skipped when another customer already has that number),
  else the filled address's phone. Same for an email typed by hand that matches a customer and
  for "Create order" from a customer's page (`draftForCustomer`). `contactPhoneFrom` in
  draft-form-state.ts.
- **State:** a new address starts blank ("Select state") instead of defaulting to Haryana; a full
  PIN code that belongs to one state fills it in; a saved address whose state contradicts its PIN
  code shows the PIN's state (`stateFor`, using `stateForPincode` / `stateMatchesPincode` from
  `@commerce/core/checkout-settings`). Saving with no state still asks for one.
