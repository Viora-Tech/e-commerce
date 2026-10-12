# Checkout in three steps: shell, summary on every step, step machine

**Branch** `feat/checkout-shell` (from `dev`), **no migration**. First of three stacked branches
(`feat/checkout-contact-address`, `feat/checkout-delivery` follow). Design: Figma file
`YmMNC5JOimqg61sI0eFI5a`, page **Checkout** (frames `Checkout / Contact|Address|Delivery|Payment`),
folded into the owner's three steps (contact sits at the top of Address).

## What shoppers see

- `/checkout` is now three steps: **Address** (express UPI, contact, delivery address) →
  **Shipping** (delivery method) → **Payment** (ways to pay, order note, Pay). Gift-card-only
  baskets skip Shipping (Details → Payment).
- Desktop: a quiet header (logo, "Secure checkout"), the steps on the left, the **order summary
  card on the right on every step** (lines, discount and gift card, rows, total, "Inclusive of
  all taxes", pre-order due today/later, EMI line), sticky. Numbered progress at the top; a
  finished step is a button back to it. Above the current step, a recap of the finished ones
  ("Contact", "Ship to", "Delivery") with **Change**.
- Phone: header, the "Show order summary · ₹X" bar, "Step 1 of 3 · Address" over a segmented
  bar, the step, and the main button **sticky at the bottom** (Back shrinks to an arrow there).
- The step lives in the URL (`?step=shipping`, `?step=payment`; Address has none), so the
  browser's back/forward buttons walk the steps and a reload stays put. The typed details and
  picks are kept per cart in `sessionStorage` (this tab only), so a reload on Payment comes back
  to Payment. A step whose earlier gate fails is shown as the step that needs work and the URL
  is corrected (a guest opening `?step=payment` lands on Address).
- Gates: Address continues only when every field checks out (Continue shows the inline errors
  and focuses the first wrong field); Shipping continues only once a rate is picked or shipping
  is free (button waits while the courier quotes; unserviceable blocks). A re-quote in flight
  never bounces the shopper off a later step; a quote that comes back with no way to ship does.
- Enter in any field continues; on the last step it pays. Focus moves to the new step's heading
  and the page scrolls to the top on every step change.

## Code notes

- Machine: `apps/storefront/src/lib/checkout-steps.ts` (pure: `stepsFor`, `parseStep`,
  `resolveStep`, `transition`, `canVisit`, `stepStatus`, `stepSearch`), tests beside it.
  `lib/use-checkout-step.ts` binds it to the URL with `history.pushState`/`replaceState`, which
  Next 16 syncs with `useSearchParams` (no server round trip).
- `lib/use-checkout-form.ts` holds what `checkout-form.tsx` used to (state, shipping quotes,
  totals, submit) plus the gates and the draft; `checkout-form.tsx` only draws. Step bodies:
  `checkout-address-step.tsx`, `checkout-payment-step.tsx`, Shipping is `DeliveryMethod` as before.
- Draft: `lib/checkout-draft.ts` (validated on read, other carts' drafts ignored, gift cards not
  kept), tests beside it. Recap rows: `lib/checkout-recap.ts`, tests beside it.
- Frame: `checkout-steps-shell.tsx` (the form page only; pay, thank-you and balance pages keep
  `checkout-shell.tsx`). New token `--ck-card-shadow` in `globals.css` (none in dark mode). The
  summary card wears the branding's summary colour or image; accent, button colour, font and
  corners come from Settings → Checkout → Branding as before.
- Removed `checkout-section.tsx` and `pay-button.tsx` (replaced by `checkout-step-panel.tsx`,
  `checkout-progress.tsx`, `checkout-step-nav.tsx`, `checkout-recap.tsx`).
- Unchanged: `checkoutAction`, `placeOrder`, payment providers' popup flow, discounts, gift cards,
  COD rules, pre-orders, EMI, PIN-state rule, minimum order, one `<form>` (#224, still tested).
- `bun run test:sweeps`: `file-size` fails on `apps/storefront/src/lib/liquid-theme.ts` (509
  lines) on `dev` already; not touched here.
