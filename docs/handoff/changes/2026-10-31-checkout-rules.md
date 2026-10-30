# Checkout and payment rules (31 Oct 2026)

Admin audit #150, #154, #156, #158. No migration: everything lives in the store's settings JSON
(`store.preferences.checkout`, `store.payments`).

## #154 Checkout field rules

- `packages/core/src/checkout/fields.ts` (pure, via `@commerce/core/checkout-settings`):
  `CheckoutFieldsSchema` (`name: full|split`, `company: hidden|optional|required`,
  `line2: hidden|optional|required`), `addressFieldErrors`, `splitName`, `joinedName`,
  `keptBusinessName`. Stored as `CheckoutSettings.fields`.
- Server: `validateCheckoutContact` judges the field rules whenever a `name` is passed (older
  callers that send none are not judged). `CheckoutDetails` gained `firstName` / `lastName`;
  `name` stays the full name. A company name is now kept without a GSTIN when the field is shown.
- Storefront: `CheckoutNameFields` (one name, or first + last, then company), line 2 hidden /
  required in `CheckoutAddressFields`; `checkoutFieldErrors` takes `rules.fields`;
  `CheckoutFormState.lastName` (optional, kept in the tab draft); the GST section drops its
  business-name box when the company is asked in Delivery. The order, contact capture and the
  address book get the joined name (`fullNameOf`).
- Admin: Settings → Checkout → **Form fields** (`checkout-fields-card.tsx`).

## #156 Add-to-cart limit

- `packages/core/src/checkout/cart-limit.ts`: `CartLimitSchema` (`maxPerProduct`, 0 = none;
  `overrides: [{ productId, max }]`), `productCartLimit`, `lineRoom`, `cartLimitBreach`.
  Stored as `CheckoutSettings.cartLimit`. Counted per product across its variants; gift cards
  never limited.
- `addToCart` clamps the line to the room left (a new line with no room throws
  `CartLimitExceeded`), `setLineQuantity` clamps, `getCart` caps each line's `available` so the
  stepper stops, and `placeOrder` (`enforceCheckoutRules`) throws `CartLimitExceeded`, shown as
  `checkoutContent.errors.cartLimit`.
- Admin: Settings → Checkout → **Cart limit** (`cart-limit-card.tsx`, products picked through
  the Browse dialog with a limit box per row).

## #158 Edit checkout wording

- `packages/core/src/checkout/content.ts`: `CHECKOUT_TEXT_KEYS` (28 dotted paths into the
  storefront's `checkoutContent`), `CheckoutTextSchema` (`{ en, hi }`, unknown keys and blanks
  dropped, 200 chars max), `checkoutTextFor(text, locale)` (Hindi falls back key by key to the
  English override), `applyCheckoutText(base, overrides)` (replaces string leaves only).
  Stored as `CheckoutSettings.content`.
- Storefront: the checkout page resolves the overrides for the request's market locale
  (`x-market-locale`) and passes them as `text`; `useCheckoutForm` returns `ck.copy`
  (`CheckoutCopy`), read by the section headings, Express heading, contact, delivery, name,
  GST and note fields, the summary heading and taxes line, the Secure pill and the gift-card
  "Place order" label. Defaults stay in `apps/storefront/src/data/checkout.ts`;
  `checkout-text.test.ts` checks every key is a string there.
- Admin: Settings → Checkout → **Checkout content**, "Edit checkout content" dialog with
  English / Hindi tabs (`checkout-text-card.tsx`, `checkout-text-dialog.tsx`). Admin copy:
  `data/checkout-rules.ts` + `data/hi/checkout-rules.ts` (the defaults shown as placeholders
  are a copy of the storefront's words).
- Not covered: the sign-in (OTP) screen's phone/email labels, payment method names, error
  messages and the thank-you page keep our wording.

## Tests

`fields.test.ts`, `cart-limit.test.ts`, `content.test.ts`, new cases in
`checkout/settings.test.ts`, storefront `checkout-text.test.ts`. Not run here (checks run on dev).
