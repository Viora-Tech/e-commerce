# Checkout hydration #418: imported theme scripts, UPI QR clock

**Branch** `fix/checkout-hydration-418` (from `main`), no migration.

- The open item in `2026-10-01-security-owner-decisions.md` (checkout #418 with or without the
  CSP) was the nested discount form, fixed by #224. On today's `main`, a production build with a
  copy of the dev data showed zero hydration errors on the checkout with the native theme
  (guest, cart with items, desktop and phone, light and dark, browser in IST, UTC and New York,
  server in UTC). Two causes remained:
- **Imported Shopify theme (main or previewed)**: `/checkout` threw #418 on every load. The
  theme's `reveal.js` (Zero Drift / Glide) wraps every `main h1`–`h3` in
  `<span class="heading-rise__inner">` before React hydrates. A heading with mixed children (the
  step headings: sr-only "Step 1 of 4: " + "Contact") no longer matched, React re-rendered the
  page, and the new headings stayed hidden under the theme's `html.js main h2 { opacity: 0 }`.
  The theme's CSS also reached the "locked" checkout. Fix: the store layout drops the imported
  theme's shell, header and footer on `/checkout/*` (`liquidLayoutForPath` in
  `apps/storefront/src/lib/checkout-path.ts`, shared with `StoreChrome`); the checkout then uses
  the native frame, with the standalone `ConsentManager` (banner if undecided, tracking tags if
  allowed, so a purchase is still measured).
- **UPI QR step** (thank-you page): the countdown read `Date.now()` during render. The text had
  `suppressHydrationWarning`, but a QR that had closed on one side only (shopper's clock ahead,
  or the QR closing between server render and hydration) drew "expired" on one side and threw
  #418 (reproduced with the browser clock 25 minutes ahead). The clock is now read after
  hydration: the first render is the open QR without a countdown, the pill appears on mount,
  and the `suppressHydrationWarning` band-aids are gone.
- Tests: `lib/checkout-path.test.ts` (checkout never gets the theme shell),
  `components/checkout/upi-qr-payment.test.ts` (server HTML identical at two clock readings;
  fails on the old component).
- Checked in a production build (headless Chromium, throwaway DB `commerce_hydration_dev`, a
  copy of dev with payments, couriers and apps stripped; manual UPI + COD): product, cart,
  checkout, order placed, thank-you, thank-you with a UPI QR (clock normal, 25 min ahead, 90 min
  behind), with the native theme and with the imported theme as main. Zero hydration errors.
- **Not fixed here** (imported theme, other pages): our React pages inside an imported theme's
  layout (cart, search, account, product) can hit the same `reveal.js` rewrite if one of their
  `main` headings has mixed children; none did in this check. The theme also logs CSP
  violations for inline `on*=` handlers and a `<link rel=preload>` with an invalid `href`.
