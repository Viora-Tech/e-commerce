# Checkout: one page of numbered cards, admin-look defaults

- New `apps/storefront/src/components/checkout/checkout-sections.tsx` replaces
  `checkout-progress.tsx`, `checkout-recap.tsx` and `checkout-step-panel.tsx` (deleted). Each step
  (Contact, Address, Delivery, Payment) is a card: the current one is open with its fields and
  button, finished ones fold to one line with Change (from `recapRows`), later ones wait greyed.
  The step still lives in `?step=` (`useCheckoutStep`), so gates, back/forward and reload are as before.
- Defaults match the admin panel: `DEFAULT_CHECKOUT_COLOURS` in `packages/core/src/checkout/branding.ts`
  uses `#171717` accent/button, white summary, Plus Jakarta Sans; neutrals and the card shadow
  match in `CHECKOUT_LIGHT_SURFACE` and the `.ck` block of `apps/storefront/src/app/globals.css`.
  Stores with saved checkout branding keep theirs.
- `payment-methods.tsx`: one card per gateway with the gateway's name chip in its brand colour
  (allow-listed in the hardcoded-colours sweep); picked card gets an accent outline.
- Summary card on desktop drops its border for the same shadow as the step cards.
- Mockups: https://claude.ai/artifact/YAUcrfjqPNipnh3EyvooGp
