# Storefront review of Waimers on Koomerce (29 Oct)

- Report: `docs/reviews/2026-10-29-storefront-review.md` (findings ranked, screenshots beside it).
  Issues opened: #934 (₹0 pre-order variant reaches Pay ₹0), #935 (policies 404), #936
  (pre-order arrival note), #937 (UPI 3% not shown), #938 (collection filters), #939 (pre-order
  quantity).
- New `scripts/smoke/storefront-audit.ts`: per-page audit (status, TTFB/LCP, console errors,
  4xx, broken images, phone overflow, SEO tags, a11y basics) on desktop and phone, read only.
- Fixed: CSP error on every page from the theme's print-stylesheet `onload` (now
  `data-theme-promote`, switched on by the shim) and empty JSON-LD scripts (`liquid-defer.ts`,
  #940); availability line no longer in the error red (#941); `/account/register` redirects to
  sign-in and the cart page has a title (#942).
