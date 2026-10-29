# Checkout phone no longer gains a leading 0 (#926)

Branch `fix/926-checkout-phone-zero`. No migration.

- **Cause:** the storefront phone field (`packages/blocks/src/components/store-phone-input.tsx`,
  on react-phone-number-input) fills its number box from libphonenumber's `formatNational()`
  whenever the value comes from outside the box: the checkout draft after a reload, a saved
  customer or address prefill. For Indian numbers that format writes the optional trunk prefix,
  so `+919999999999` showed as `099999 99999`. The stored value was always right; only the box
  gained a digit (and a shopper who then edited it saw 11 digits).
- **Fix:** the field passes the picker a copy of the min metadata where formats whose national
  prefix is optional drop the prefix rule (`withoutOptionalTrunkPrefix`). India now shows
  `99999 99999`; countries that need the 0 (UK `07911 123456`, France) are unchanged, and a 0 the
  shopper types is still read as the trunk prefix. Every storefront phone field (checkout,
  account, phone sign-in, notify-me) uses this component, so all of them are fixed.
- **Saved value:** unchanged. The checkout sends E.164 (`+91…`) and the server stores the ten
  digit mobile (`normaliseMobile` in `validateCheckoutContact`), whatever shape was typed.
- `packages/blocks` now lists `libphonenumber-js` (already in the lockfile via core and RPN).
- Tests: `packages/blocks/test/store-phone-input.test.tsx` (box shows ten digits for E.164,
  10-digit, 0-prefixed, 91-prefixed, spaced/dashed values; UK keeps its 0),
  `apps/storefront/src/lib/checkout-draft.test.ts` (phone round-trips through the draft),
  `apps/storefront/src/lib/checkout-validation.test.ts` (every shape passes as the same mobile).
- Not changed: the admin `packages/ui/src/components/phone-input.tsx` (see PR notes).
