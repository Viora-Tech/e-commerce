# Checkout: the store's logo on imported themes, and a type pass

Owner: "the layout is good, but the text and logo feel cheap." Layout unchanged.

## Logo
- A store on an imported Shopify theme (Waimers: "Glide") with no logo in Settings → Checkout →
  Branding showed its name in heavy type: `storeCheckoutLook` only falls back to our own theme's
  `brand.logo`. The checkout now falls back to the logo the imported theme keeps in its header
  group or theme settings (`liquidThemeLogoUrl`, the same pick the Inbox chat avatar uses).
- `lib/checkout-look.ts` `withThemeLogo(storeId, look)`, applied on the checkout, pay,
  thank-you, balance and invoice pages. `lib/inbox-logo.ts` gained `liveLiquidLogoUrl(storeId)`
  (the live theme id from the same `main-theme` cache entry the layout reads).
- The logo draws at 2rem (2.25rem from `sm`), up to 11–12rem wide; the name without a logo is
  semibold with tight tracking instead of extrabold with wide tracking.
- Not changed: the error pages (`errorHelpAction`) and the admin Branding preview still show the
  name when Branding has no logo.

## Type
- No monospace and no tracked capitals in the checkout's labels: "Express checkout" is a
  sentence-case heading like the cards'; the card numbers, the summary's "2 items" and the
  quantity badge use the checkout font with tabular figures; "Fastest", "Default", "Pre-order"
  and the payment option tags are sentence case.
- Nothing under 0.6875rem: tags and option descriptions 0.75rem, the Pay footnote 0.75rem (0.6875rem
  in the phone's Pay bar).
- Weights: card and summary headings, prices, the total and the Pay button are semibold instead
  of bold or extrabold; card titles 1.0625rem from `sm`; the total 1.375rem with tabular figures;
  Pay 1rem.
- Payment brand marks (GPay, PhonePe…) keep their own heavy lettering.

Already in place before this change (the owner's earlier list): arrival dates on the shipping
options, the Pay bar fixed to the bottom of a phone, the "We never see your card or UPI PIN"
line under Pay, and the free-shipping bar in the cart.

Tests: storefront `src/components/checkout` and `src/lib` (53 files, 312 tests); storefront
typecheck.
