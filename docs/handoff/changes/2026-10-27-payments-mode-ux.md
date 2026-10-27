# Payments Live/Test switch redesign (2026-10-27)

Owner: the test/live switch on every gateway felt unclear. Redesigned Stripe/Razorpay-dashboard style as one shared control.

## Audit (before)
- Razorpay/Cashfree cards: a "Test mode" on/off switch, disabled (no reason shown) when the other key set was missing; mode only as a small chip.
- Razorpay/Cashfree Connect page: a separate Test/Live toggle with its own styling; no sign of which sets were saved or which one checkout used.
- Decentro Connect page (generic ProviderConnectPage): the Test/Live toggle only relabelled the keys on screen (`mode` field). Flipping it and saving could tag test keys as live, and saving keys of the other mode switched checkout straight away, without the confirmation the cards ask for.

## Now
- `components/payments/payment-mode-control.tsx`: the one "Live | Test" segmented control (Live first, Test pressed is amber, a dot per segment: in use / saved / missing). Used by the gateway switch, the Razorpay/Cashfree Connect form and the Decentro Connect page.
- `components/payments/gateway-mode-switch.tsx` (replaces `gateway-switches.tsx`): the control, a Live keys / Test keys row each with "In use at checkout / Saved / Not added" and Add/Edit links (`/apps/<id>/connect?keys=<mode>`), an inline "add your live keys first" block when keys are missing, and the existing confirm dialog otherwise. Now on every gateway card on Settings → Payments (main and others) and on the gateway page.
- `payment-mode-badge.tsx`: green "Live" / amber "Test mode" chip on every card, the Decentro overview included.
- `test-mode-bar.tsx`: "Test mode — no real money moves"; `variant="card"` strip on test-mode cards; the page bar now also heads the gateway Overview and Connect pages.
- Decentro: `ModeSwitch.keySets` makes ProviderConnectPage edit one saved key set at a time (`apps/shared/connect-key-sets.ts`); saving the set checkout is not using parks it and never switches checkout.
- Logic tests: `components/payments/mode-switch.test.ts`, `components/apps/shared/connect-key-sets.test.ts`.

No API or data-model change. Copy in `data/payment-modes.ts` + Hindi overlay.
