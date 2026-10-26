# Customer page: WhatsApp/SMS consent, contact phone from the order, long emails (#810)

Branch `fix/customer-phone-consent-810-2026-10-26`. No migration.

## Cause

- The Marketing consent card listed a channel only when the store could send on it or the
  customer had already said yes. A store without WhatsApp/SMS set up saw "Email" alone, so
  phone consent could not be recorded at all.
- The reported customer was imported from Shopify. Shopify had no customer-level phone, only a
  phone on the default/shipping address. The customer importer stored `customer.phone` from
  Shopify's customer phone only (the API path; the CSV path already fell back), and the order
  importer created the buyer without the shipping phone. So the contact phone stayed empty while
  the address showed 7904115879.
- Contact card: `KeyValueList` broke values with `break-words`, so a long email wrapped mid-word.

## What changed

- **Consent card** (`marketing-consent-card.tsx`): every channel is listed. A channel the store
  does not send on yet says "Not set up in your store yet". With no contact phone, WhatsApp and SMS
  are switched off and disabled (a yes already given can still be withdrawn), with "Add a phone
  number to ask for WhatsApp/SMS consent" and the phone prompt below. Consent still goes through
  `customerPrivacy.setConsent` (source `admin`, staff actor, every change in the history);
  nothing switches consent on by itself.
- **Contact phone from the order** (core `customers/contact-phone.ts`):
  - `suggestContactPhone` looks, for a customer with no contact phone, at the latest non-draft
    order (order phone, then shipping address phone), then the default saved address, then the
    `defaultAddress` snapshot, and returns the first valid ten digit mobile (`normaliseMobile`,
    the same as `createCustomer`) and who else already has it (`customerWithPhone`, now exported
    with an `exceptId`).
  - `adoptContactPhone` works the number out again on the server, refuses `has_phone`, `none`, or
    `duplicate` (another customer has it), stores it encrypted with its blind index and
    `phoneVerifiedAt` null, writes `customer.updated` to the outbox and a `contact.phone_added`
    privacy audit entry (detail: field and source, never the number). Consent is untouched.
  - oRPC: `customers.get` returns `phoneSuggestion`; new `customers.adoptContactPhone`
    (`CUSTOMERS_WRITE`, CONFLICT with `existingId` on a duplicate). MCP action docs regenerated.
  - Admin: `contact-phone-prompt.tsx` shows "Use 79041 15879 from their latest order" (one
    click), or "… belongs to another customer" with a link to them, plus "Add phone" (opens the
    edit dialog). Shown in the Contact card and under the consent switches. One customer at a
    time; there is no bulk copy.
- **Shopify import going forward**: customers store Shopify's customer phone, else the default
  address phone (`contactPhoneOf`). Matching still uses only the customer phone, so a shared
  address number never merges two shoppers. A re-import with no phone no longer wipes a stored
  one. Buyers created from an imported order get the order phone, else the shipping phone (as
  checkout does).
- **Long emails**: `KeyValueRow.truncate` keeps the value on one line with an ellipsis, the full
  value on hover (`title`) and in the copy button. The Contact card's email uses it.
- Copy: `customerDetailContent.contactPhone` (en + hi); audit label in `customer-privacy.ts`.

## Tests

- `packages/core/src/customers/contact-phone.test.ts` (DB): source order, fallbacks, invalid
  numbers, duplicate, the write (encrypted, unproven, outbox, audit, no consent), refusals.
- `packages/plugin-shopify-import/src/contact-phone.test.ts`: customer phone first, address
  fallback without changing the match key.

## Not done

- Existing customers are not backfilled in bulk; staff use the one-click prompt per customer.
- `customerPrivacy.setConsent` does not refuse WhatsApp/SMS for a customer without a phone on
  the server; the admin disables those switches.
