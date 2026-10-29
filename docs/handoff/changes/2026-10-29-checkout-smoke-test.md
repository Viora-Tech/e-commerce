# Checkout smoke test before a release

Branch `feat/release-smoke-test`. `bun run smoke:checkout -- --base <store URL>`
(`scripts/smoke/checkout-smoke.ts`), now the first step of developer docs "Release checklist".

- Walks a guest on desktop (1366×900) and phone (Pixel 7): home, a collection, a search, a typo
  search, Add to cart on the first in-stock product, the cart line (image + price), cart → checkout,
  guest contact (`success@simulator.amazonses.com`, `9999999999`), PIN 131001 (Haryana) then 400001
  (Maharashtra): city/state must fill, Shipping must list an option and never "We do not ship" /
  "We cannot deliver" (the 21 Oct bug). Stops when Payment lists a method; never presses Pay.
- Dismisses cookie banners and any dialog with a Close button (signup popup) via
  `page.addLocatorHandler`. Fails on page errors or 5xx from the store.
- Pass/fail table on stdout, non-zero exit on any failure, full-page screenshots of failed steps
  in `%TEMP%/koomerce-smoke-<time>/`. Options: `--viewport`, `--query`, `--pin 744101:AN`.
- `playwright@1.63.0` pinned as a root devDependency (its Chromium 1243 is the one already on the
  dev PC). Runs on Node (`node --no-warnings`, type stripping): Bun on Windows hangs on
  Playwright's `--remote-debugging-pipe` launch.
