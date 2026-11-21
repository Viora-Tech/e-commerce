# Checkout step in the URL

Why: owner, 21 Nov 2026: phone Back left checkout instead of going to the previous step.

What changed (storefront):

- The step on screen lives in the URL: `/checkout?step=contact|address|delivery|payment`.
  Shipping is `delivery` (the word the shopper sees); old `?step=shipping` links still work and
  are rewritten to `delivery`. Other query parameters are kept.
- A move the shopper makes (Continue, the stepper, "Back to …", a review row's Change) pushes a
  history entry with `window.history.pushState` (Next syncs it; no server refetch). Moves the
  page makes by itself (opening, falling back, Pay pointing at a field to fix) use
  `replaceState`, so there is no extra entry.
- Back/Forward (`popstate`) opens the URL's step, checked like any link.
- A link never skips a step (`resolveStep` in `lib/checkout-sections.ts`): if a step before it
  is not done, the first unfinished step opens and the URL follows. While the courier is still
  quoting (gate `pending`) the page holds the asked step instead of bouncing. The URL step is only
  checked once the tab's draft is restored, so a reload keeps the step.
- Gift-card-only baskets have no Delivery step: `?step=delivery` falls back.
- `followLegacyStep` (which read `?step=` once and deleted it) is gone.

Files: `lib/checkout-sections.ts`, `lib/checkout-step-url.ts`, `lib/use-checkout-step.ts`,
`lib/use-checkout-form.ts`, `lib/checkout-scroll.ts`; tests in `checkout-sections.test.ts`,
`checkout-step-url.test.ts`, `components/checkout/checkout-form.test.ts`.

Note: a guest who reloads lands on Contact again, because choosing "Check out as guest" is not
restored from the draft on purpose (sign-in comes first, every time).
