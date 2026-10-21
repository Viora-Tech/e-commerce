# Razorpay settings: events list and Shopify-style Deactivate

- The Razorpay "paste keys" step now lists every webhook event to tick (from `RAZORPAY_WEBHOOK_EVENTS`, sent as `payments.setup().razorpayWebhookEvents`), with a copy button. The guide text no longer names a short, outdated list.
- Gateway cards: the Active/Inactive switch is replaced by a bottom-left "Deactivate <gateway>" button (asks first, keys stay saved), or "Activate <gateway>" when off (`gateway-active-footer.tsx`). The Live/Test switch stays where it was.
- `isModeGateway` moved to `components/payments/types.ts`.
- Blue Dart logo SVG gets a `<title>` (lint).
- Saving live keys while checkout still runs on test keys now asks "Start taking real payments?" right away (Go live switches checkout; closing keeps test keys and says so). Before, the keys were parked silently behind a toast and the "Test mode — payments are not real" banner stayed on, which looked like a bug.
