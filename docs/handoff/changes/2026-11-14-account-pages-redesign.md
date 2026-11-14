# Shopper sign-in and order pages in the checkout's look

Design: Figma "Storefront · Pages" → Pages · 3 · Account: Shopper · Sign in (redesign) 948:15521,
Enter code 948:15578, State · Wrong code 705:113326, Account · Orders 705:114056 / 705:114276,
Order detail 705:114449 / 705:114664. Pieces and tokens from the checkout ("Checkout · Polish").

- **Frame** (`account-frame.tsx`): every account page now sits in a `.ck ck-account` scope with the
  store's checkout branding (`storeCheckoutLook` → `checkoutBrandingVars`: accent and button fall
  back to the theme's brand colour). Light by default; dark when the store's mode or, when the store
  leaves it to the shopper, `prefers-color-scheme` says so — the same rule as the checkout. The
  theme's `--color-*` names point at the `--ck-*` palette inside it, so addresses, profile, privacy
  and the nav match without a rewrite. `body:has(.ck)` dock padding now skips `.ck-account`, so the
  theme's mobile dock still has room on account pages. `AccountFrame` takes `storeId` (all four
  callers pass it).
- **Sign in**: card with the checkout's field, button and shadow; phone field is the checkout's
  `PhoneInput` look; email field is `CheckoutField` (`type=email`, `inputmode=email`,
  `autocomplete=email`); Send code with arrow, spinner while sending; "or", provider buttons
  outlined; "Use email/mobile instead" and "Sign in with a passkey" as one row of links; the
  guest/account note under a hairline; perks under the card. SMS/WhatsApp choice is a two-way
  segmented control. Errors sit under the field (red edge, alert icon, aria-describedby).
- **Code step** (`account-code-step.tsx`): Back, "Enter the code", "Sent by SMS to +91 …", six
  boxes (input-otp + the checkout's `CheckoutCodeSlot`, `autocomplete=one-time-code`,
  `inputmode=numeric`; red boxes when refused), resend countdown "Resend code in 0:24", then
  "Send a new code" and, when the store has both phone methods, "Get it on WhatsApp/SMS" (after the
  same 30 s wait the server enforces), "Keep me signed in on this device", Verify and sign in. The
  sixth digit submits by itself. Quick ways in are hidden on this step.
- **Orders**: cards with number, date · items, delivery pill (payment pill only when not simply
  paid), up to three product pictures and the total; staggered rise. New `thumbnails` on
  `ShopperOrderSummary` (`orderThumbnails` in `packages/core/src/accounts/orders.ts`, tested).
  Empty state with a bag mark and Start shopping.
- **Order detail**: Back link, `h1` Order #n with pills, Buy again (secondary, refresh icon),
  cards for tracking (accent dot on the newest scan), parcels, items, returns; summary split into
  `order-summary-card.tsx`; address and payment in one card; documents as download buttons.
- Motion: cards use `CK_LIFT` (280 ms rise, fade only under reduced motion). Tap targets ≥ 2.75rem
  (links `min-h-11`, buttons `h-11`–`h-13`, nav rows).
- New icons `arrow`, `download` in `checkout-icon.tsx`; `CheckoutCodeSlot` gained `invalid` and
  `fluid` (defaults unchanged for the checkout).
- Test: `apps/storefront/src/components/account/account-pages.test.ts`.

Not changed: server actions, auth, routes, the theme `login`/`account` templates (merchant sections
still render around the pages), the return request form, addresses, profile.
