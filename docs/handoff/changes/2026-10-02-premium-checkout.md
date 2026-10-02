# Premium checkout, locked like Shopify's, with Branding settings

**Branch** `feat/premium-checkout` (from `main`), **no migration**: branding lives in the existing
`store.preferences.checkout` JSON (`branding` key, defaults for every store saved before it).

## What shoppers see

- `/checkout`, `/checkout/pay/*`, `/checkout/thank-you/*` and `/checkout/balance/*` render in the
  checkout's own frame (`components/checkout/checkout-shell.tsx`), never the theme's. The theme
  header, footer and cursor effect are hidden there by `components/checkout/store-chrome.tsx`
  (`usePathname`, so client navigations from the cart work too). They stay mounted, so the
  consent banner and the tracking tags the footer group draws keep running into the thank-you
  page.
- Desktop: order summary left on the merchant's summary colour or image (logo, big amount, line
  thumbnails with quantity badge, discount and gift card entry, rows, "Inclusive of all taxes",
  pre-order "Due today / due later", EMI line), form right with four steps on one page (Contact,
  Delivery, Delivery method, Payment) whose numbers turn into ticks when complete.
- Express **Pay with UPI** at the top: picks the store's UPI method (Decentro, or Razorpay /
  Cashfree with UPI on) and submits through the same `checkoutAction`; with details missing it
  focuses the first wrong field. Payment options are ordered UPI first, COD last
  (`offeredMethods` in `lib/checkout-preview.ts`); shoppers never see gateway brand names.
- Inline validation as you type (`lib/checkout-validation.ts`: email, mobile, PIN, name,
  address, city, state against the PIN prefix, GSTIN when the business box is ticked), shown on
  blur or after a Pay attempt, with a live "Check the N highlighted fields" banner. `noValidate`
  on the form; the server still re-checks everything.
- A PIN whose prefix allows one state fills the state in (`stateForPincode`, core), unless the
  shopper picked one; the India Post directory lookup still wins when it is installed.
- Pay button shows the exact amount ("Pay ₹7,499", "Place order · ₹7,499" for COD), a shimmer
  while shipping re-quotes and a spinner while placing. Sticky at the bottom on phones; the
  summary folds into a "Show order summary · ₹X" bar.
- Thank-you: calm status mark, headline by state (confirmed / complete your payment / did not go
  through), UPI QR on desktop and app buttons on phones, transfer details, pre-order balance,
  order details (contact, address, delivery, payment), retry / pay now.
- Dark mode follows the store (`data-theme` on `<html>` or the system setting).

## Merchant side

- **Settings → Checkout** now has tabs: **Checkout form** (contact, address, minimum, COD) and
  **Branding** (logo, accent, Pay button colour, font from six self-hosted faces, corners,
  summary colour or image, toggles for GSTIN field, order notes, trust line) with a live
  computer / phone preview. The GSTIN and order-note toggles moved into Branding; the settings
  search link is now `/settings/checkout?tab=branding#gstin`.
- Copy: `apps/admin/src/data/checkout-settings.ts` (`checkoutBrandingContent`) with a Hindi
  overlay in `data/hi/checkout-settings.ts`.

## Code notes

- Core: `packages/core/src/checkout/branding.ts` (schema, `checkoutBrandingVars` → `--ck-*`
  properties, readable text colour by contrast), `storeCheckoutLook` and `variantImageUrls` in
  `checkout/service.ts`, `storeName` on the settings view.
- Storefront tokens: the `.ck` block and `--color-ck-*` in `apps/storefront/src/app/globals.css`.
  The theme's base CSS is unlayered and beats Tailwind utilities (`h1..h6`, `button`,
  `* { margin: 0 }`, `img { height: auto }`), so checkout classes use `!` where they meet those
  (see `lib/checkout-classes.ts`). Arbitrary `box-shadow` values must use the raw `--ck-*`
  properties: `@theme inline` names (`--color-ck-*`) do not exist at runtime.
- `nonRefundableDepositDays` became `cartDepositTerms` (also returns the balance left for later).
- `place-order.ts` is untouched; payments, discounts, gift cards, COD rules, rate limits, CSP
  nonces and the single-form rule (#224) are unchanged. `checkout-form.test.ts` asserts one form.
- Not done: true wallet-style express pay (UPI before any address) needs a gateway express
  product (e.g. Razorpay Magic Checkout); the express button needs the details filled first.
