# Phone input with country flags (2026-10-11)

Every phone field now uses one international input: a searchable country picker (flag +
calling code, like +91) in front of a number box that formats as you type. The value is stored
as E.164 (`+919876543210`). Old values ("98765 43210", "919876543210", "+91 98765-43210") still
load and are read as Indian numbers.

## What changed
- `react-phone-number-input` 3.4.18 and `libphonenumber-js` 1.13.15 (MIT, LICENSE files read
  2026-10-11), credited in `THIRD_PARTY_NOTICES.md` and the radar ("In use").
- `packages/ui/src/components/phone-input.tsx` (`@commerce/ui/phone-input`): the admin input on our
  Popover + Command + Input + Button. `phone-input-lazy.tsx` loads the flag list on demand.
- `packages/blocks/src/components/store-phone-input.tsx` (`@commerce/blocks/phone-input`,
  `phone-input-lazy`): the storefront twin. The storefront has no `@commerce/ui`, so it is a small
  self-contained picker on the theme's tokens; the locked checkout passes its own `CK_INPUT` box.
- `packages/core/src/accounts/phone.ts` (`@commerce/core/phone`): `normalisePhone(raw, 'IN')` ->
  E.164 or null, `isValidPhone`, and `lenientPhone(max)` for API schemas (valid numbers are saved as
  E.164, other text is kept as typed so old records still save).
- Server: store contact phone (`StoreGeneralSchema`) validates with `isValidPhone` and saves E.164;
  `lenientPhone` on customer update, supplier, privacy-request contact and the GST invoice seller phone.
- Admin forms: profile, GST seller, customer address, edit customer, waitlist, order contact,
  log privacy request, purchase-order supplier card, store general settings, location pickup,
  new supplier, supplier form. Help copy in Settings -> General no longer says "include +91".
- Storefront: profile form, checkout contact, notify-me form, phone login, notify-me block.

## Decisions to know
- The storefront accounts, OTP login, address and checkout checks (`normaliseMobile`) only accept
  Indian mobile numbers, so those four forms pass `countries={['IN']}`: the flag and +91 show, the
  picker is locked. Widening them to other countries needs the server checks and the SMS/WhatsApp
  senders widened first. The notify-me form and block (WhatsApp alerts) offer every country.
- The notify-me inputs submit through a hidden field so the server gets E.164, not the formatted text.
- Picker text ("Search country or code", "No country found.") is English-only; country names come
  from the library's English list.
- Order contact phones still go through `normaliseMobile` in `order/contact.ts` (Indian numbers are
  stored as ten digits there); unchanged.
