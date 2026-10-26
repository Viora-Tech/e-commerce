# Checkout: one page that matches the approved design

The live checkout looked nothing like the approved design (checkout-design `Main.dc.html` /
`Mobile.dc.html`). Why: PR #771 restyled the old step machine as cards but kept it. One step
was open at a time (`?step=` in the URL, `useCheckoutStep`), with Continue/Back, step headings
("Where should we deliver?") and express UPI inside the Address step. The design is one page
with every card open.

## What changed (apps/storefront)

- **One page.** `checkout-form.tsx` now renders Express checkout (its own card, top), then
  numbered cards 1 Contact, 2 Delivery, 3 Shipping, 4 Payment (`checkout-card.tsx`), all
  open. The order summary sits on the right from `lg`, with "Delivers to PIN by date", Pay
  and the "Payments by … · We never see your card or UPI PIN" line inside it. On a phone it is
  a "Show order summary ▾ ₹X" card at the top and Pay is a bar fixed to the bottom.
- **Gone:** `checkout-steps.ts`, `use-checkout-step.ts`, `checkout-recap.ts`,
  `checkout-sections.tsx`, `checkout-step-nav.tsx`, `checkout-pay-footer.tsx`,
  `trust-line.tsx`, `checkout-address-step.tsx`, `checkout-contact-step.tsx`.
  `checkout-steps-shell.tsx` is now `checkout-page-shell.tsx` (header: store name + "Secure"
  pill). `displayPhone` moved to `lib/display-phone.ts`.
- **New:** `lib/checkout-sections.ts` (pure: sections, gates, `sectionFromParam`,
  `firstOpenSection`, tested), `lib/checkout-scroll.ts`, `checkout-card.tsx`,
  `checkout-pay-button.tsx`, `checkout-gst-fields.tsx`, `payment-mark.tsx` (GPay/PhonePe/Paytm/
  UPI/VISA/RuPay marks; allow-listed in the hardcoded-colours sweep), `radio-dot.tsx`.
- **Contact:** a guest gets Mobile number + "Email for the receipt" at once, with "Sign in"
  in the card heading (`guest` now defaults to true unless the store needs an account).
  Account-required stores still show the code first.
- **Delivery:** PIN first. A green "Gurugram, Haryana · by Thu, 29 Oct" line sits beside it
  (`deliveryBy` in `checkout-preview.ts`). Then Full name, "House number, street, area", and
  Landmark / City / State in one row. City and State turn soft grey when filled from the PIN.
- **Shipping:** radio cards with name, date, price; "To 122001" beside the heading.
- **Payment:** gateway radio cards with the brand chip (Decentro now gets one too), the marks
  of what each takes, the method discount as a green chip (−2%), and the detail growing open
  on select. "Get a GST invoice for my business" moved here from Delivery.
- **Pay** checks every card in page order: the first wrong field, then shipping. It scrolls
  there and focuses it (`bringIntoView`; smooth scroll, or a jump with reduced motion).
- **Old `?step=` links** (`?step=payment`, bookmarks, recovery) no longer drive anything. After
  mount the value is read once. A known section is scrolled to, anything else is ignored, and
  the parameter is dropped. The checkout error boundary is #791's `ErrorScreen`; this PR adds
  GlitchTip reporting to it (`components/errors/error-screen.tsx`), since errors caught by a
  boundary never reach GlitchTip's global handlers.

## Express checkout and shipping

Express pays with the shipping option picked in the Shipping card: the cheapest by default,
since the courier's rates come cheapest first. The line under the buttons says it, e.g.
"Pays ₹648 by UPI, with Standard shipping (₹49).", and changes when the shopper picks another
option. Until a PIN code is quoted there is no shipping price, so the line asks for the PIN
code. A tap then scrolls to what is missing (`needDetails` / `needShipping`) and places
nothing. `submit` refuses any order without a picked rate (or free shipping), whichever button
sends it.

## Motion (Emil Kowalski's rules: transform/opacity, ease-out, under 300ms, reduced motion kept)

- A card's number cross-fades into a tick when its part is filled in (opacity + scale 0.6→1,
  200ms ease-out; the badge turns success green).
- The PIN status line rises in (opacity + 4px, 200ms, `@starting-style`). It is keyed per
  message, so it only moves when the answer changes, never per keystroke.
- City and State filled from the PIN code get a brief accent wash that fades out (`ck-filled`,
  600ms, colour only).
- Radio cards (shipping, payment, saved addresses): border, fill and ring in 150ms ease-out.
  The dot fills and its centre scales 0.5→1.
- The picked gateway's detail grows open (grid rows + opacity, 200ms; opacity only with reduced
  motion).
- An applied discount chip settles in (opacity + scale 0.97). The total re-enters with a
  small fade/rise when it changes.
- Pay, the Express buttons and Apply press to `--motion-press-scale` (0.97, 140ms ease-out; 1
  under reduced motion). `CK_BUTTON_PRIMARY` used to transition `transform` while the scale
  lives on `scale`, so the press never animated.
- The error box, the express note, the GST fields and the "Delivers to" box rise in. The
  summary chevron rotates.

## Colours / dark

Colours are still only `--ck-*` (merchant checkout branding). Waimers renders dark because its
theme mode is "system" (`<html>` has no `data-theme`), so `.ck` follows the shopper's OS dark
setting. That is the existing behaviour and is kept: the layout now matches in both modes, and
the cards use `--ck-section-shadow` (a hairline ring in dark).

## Admin

`apps/admin/src/components/settings/checkout-branding-preview.tsx` now draws the one-page
layout too (Express, numbered cards, summary with Pay; phone: summary card on top, Pay bar),
with its copy in `data/checkout-settings.ts` and the Hindi overlay. `CHECKOUT_LIGHT_SURFACE`
gains `--ck-success` for the PIN line.
