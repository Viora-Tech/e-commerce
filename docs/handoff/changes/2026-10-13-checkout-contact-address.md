# Checkout contact (phone code first) and address book cards

**Branch** `feat/checkout-contact-address` (stacked on `feat/checkout-shell`), **migration
`0117_customer_address_label`** (adds nullable `customer_address.label`, checked to
`home | office | other`). Second of three stacked checkout branches.

## What shoppers see

- **Contact, phone code first** at the top of the Address step, using the store's own shopper
  sign-in (Settings → Customer accounts), not Better Auth: mobile number → **Send code** (SMS or
  WhatsApp, a choice when the store has both) → six-digit code → **Verify and continue**. "Use
  your email instead" when the store also sends email codes. Below it the store's quick ways in
  (Truecaller on Android, Google, Apple, Facebook, passkeys) in the checkout's look. Verifying
  signs the shopper in (a new number becomes a new account, as on the account page) and the
  checkout reloads as that customer, keeping anything already typed.
- **Guest vs account follows Settings → Customer accounts.** Guest checkout on: a **Check out as
  guest** button opens the plain email + mobile fields (and "Sign in with a code instead" goes
  back). Account required: no guest way; the old redirect to `/account/login` is gone, the code
  is asked right in the checkout (`checkoutAction` still refuses an order without a session).
  Continue / Enter on the contact step press Send code / Verify. The address, and express UPI,
  appear once contact is settled.
- **Saved addresses as cards** for a signed-in shopper: radio cards with name, a **Home / Office /
  Other** tag, the address, the number, and under the picked card the courier's answer
  ("Delivers to 302001" or why not). **Edit** opens the form in place of the card with Save /
  Cancel (Save writes the address book); **Delete** asks first. **+ Add new address** opens the
  form below the cards.
- **New address form is PIN-first** for everyone: PIN code → city and state filled in (India
  Post directory when installed, else the PIN prefix's state) and the delivery check under the
  PIN, then name and street. Signed-in shoppers tag it Home/Office/Other; it is saved to their
  book with the order (`rememberCheckoutAddress`, unchanged rules). GSTIN and business name stay
  optional behind their box.

## Security

- No new endpoint. The checkout calls the existing actions only: `requestPhoneCodeAction` /
  `verifyPhoneCodeAction` (`lib/privacy-actions.ts`), `requestCodeAction` / `verifyCodeAction`
  (`lib/account-actions.ts`), the provider start URLs, `passkeySignInAction`, the Truecaller
  actions, `saveAddressAction` / `deleteAddressAction` (session's customer only). Their per-number,
  per-email and per-IP rate limits, resend lockout, attempt caps and same-answer-for-new-or-known
  behaviour are untouched. `lib/checkout-otp.ts` (tested) never calls the server for a number that
  is not an Indian mobile, passes refusals through unchanged and always returns to `/checkout`.
- `TruecallerButton` and `PasskeyButton` take optional class props (the checkout's look), and
  Truecaller's code step can render without its own `<form>` (`inForm`) so the checkout keeps one
  form (#224). The account page is unchanged.

## Code notes

- Core: `ADDRESS_LABELS` and an optional `label` on `AddressInputSchema` (`accounts/schemas.ts`);
  `SavedAddress.label`; an update that leaves `label` out keeps it (the account address form has
  no tag field). DB test in `accounts.test.ts` (runs in CI; not run locally: owner rule, no DB
  copies).
- Storefront: `checkout-contact.tsx`, `checkout-otp.tsx`, `checkout-quick-sign-in.tsx`,
  `checkout-address-book.tsx`, `saved-address-card.tsx`; `checkout-address-fields.tsx` lost the
  saved-address select and the non-PIN-first order, gained the tag chips. Shipping quotes moved
  to `lib/use-checkout-shipping.ts` (keeps `use-checkout-form.ts` under the 500-line sweep).
  `CheckoutForm` is keyed by the customer id so a sign-in starts it afresh; the per-cart draft
  now also keeps the guest choice and the tag.
- Settings → Checkout's "PIN code first" no longer changes the order of the stepped checkout's
  fields (always PIN-first, per the owner's design); the setting still exists in the admin.
