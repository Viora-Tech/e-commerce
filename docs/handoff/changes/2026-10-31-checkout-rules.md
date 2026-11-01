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

## #150 Payment rules and payment capture

- **Payment rules** (Shopify's payment customizations): `packages/core/src/payments/method-rules.ts`
  (pure, also `@commerce/core/payment-method-rules`): `PaymentMethodRuleSchema` (methods to hide,
  `match: any|all`, `totalAbovePaise`, `totalBelowPaise`, `pincodes`, `productIds`; at most 20
  rules), `ruleMatches`, `hiddenPaymentMethods`. Stored on `PaymentSettings.methodRules`. The
  order total judged is the non-gift-card items after discount plus shipping (as the COD limit).
  - Server: `placeOrder`'s `enforceCheckoutRules` throws `PaymentMethodHidden` (storefront message
    `errors.paymentMethodHidden`).
  - Storefront: the checkout page loads the rules (`storePaymentMethodRules`) and
    `checkoutTotals` drops hidden methods from `offered` and moves the pick off a hidden one.
    `CartLineView.productId` was added (optional) for the product condition.
  - Admin: Settings → Payments → **Payment rules** (`payment-rules-card.tsx`,
    `payment-rule-dialog.tsx`), `payments.saveMethodRules`; `payments.setup` returns
    `methodRules` and `ruleMethods` (the enabled provider ids).
- **Payment capture**: `packages/core/src/payments/capture.ts` (`CaptureModeSchema`,
  `MANUAL_CAPTURE_GATEWAYS = ['razorpay']`, `captureModeFor`). Stored on
  `PaymentSettings.capture` (gateway id → `manual`; unset is automatic).
  - `CreatePaymentInput.capture: 'manual'` and optional `PaymentProvider.capture()` in
    `@commerce/payments`. Razorpay creates the order with `payment_capture: false` and
    captures with `payments.capture`. `claimAttempt` sets `capture` for checkout attempts only
    (never a pre-order balance).
  - The payment sits as `authorized` (unpaid-order expiry already skips authorised payments).
    `capturePayment` (`core/src/order/capture.ts`) locks order then payment, asks the gateway,
    then `applyPaymentStatus` records the capture. API `orders.capture` (ORDERS_REFUND).
  - Admin: Settings → Payments → **Payment capture** (`payment-capture-card.tsx`,
    `payments.saveCapture`); order page Payment card shows "Authorised: the money is held" and
    **Capture payment**.
  - Not done: Cashfree manual capture (needs Cashfree's pre-auth activation, cards only; shown
    as not available). Cancelling an authorised order does not void the hold at Razorpay; it
    lapses after Razorpay's window. Fallback gateways are not re-checked against payment rules.
- Copy: `apps/admin/src/data/payment-rules.ts` + Hindi overlay.

## Tests

`fields.test.ts`, `cart-limit.test.ts`, `content.test.ts`, new cases in
`checkout/settings.test.ts`, `payments/method-rules.test.ts` (rules and capture mode),
storefront `checkout-text.test.ts` and a payment-rule case in `checkout-preview.test.ts`.
Not run here (checks run on dev).
