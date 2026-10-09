# Admin redesign: Apps

Branch `feat/proofly-apps`. Figma `YmMNC5JOimqg61sI0eFI5a`: Apps home `328:21275`, installed app `331:25576`.

## Changed
- Apps home: summary line ("n apps installed · n needs setup"), featured carousel (`apps-hero`), Installed
  cards, App Store with a category rail, search and a "Built by <brand>" chip. Real states: loading
  skeletons, nothing installed, everything installed, no results.
- `AppCard` has two variants (installed: status chip + Open + menu with Uninstall; store: Install).
  A connection that is installed but has no saved credentials shows "Needs setup" (the only coloured chip).
- `AppLogo`: official logos on white for Cashfree, Decentro, Delhivery, RapidShyp, Razorpay and
  Shiprocket (`apps/admin/public/app-logos`), gradient vector tiles for the built-in apps.
- Install now opens a permission step (`install-dialog`) built from the app's manifest: what it provides
  (payments, shipping, messages, files), whether it reads order events, adds product fields or its own
  screens. Install/uninstall still call `api.apps.install/uninstall` unchanged.
- App shell header: back to Apps, big logo, title, Active chip, Settings button, tabs. Links use `routes`.
- English copy in `data/apps.ts`, Hindi overlay `data/hi/apps.ts` (new, the file had none).
- `admin-routes` sweep allow-list counts reduced for `app-shell.tsx` and the plugin page.

## Added in the second pass
- App listing page: `/apps/<id>` for an app that is not installed shows what it does, what it can access
  (same manifest lines as the install dialog), details, credits and Install (`app-listing`).
- Connect pages (Delhivery, Shiprocket, RapidShyp, Decentro): two-column wizard (steps left, fields and test
  right), logo header, "View setup guide" link (siteConfig docs URL) and a "Connected" success banner after
  a passing test is saved. Same fields and backend calls.
- Installed app page: "Needs setup" chip and banner (a connection with no working credentials) linking to
  its connect page; a menu with Uninstall and the same confirmation.
- Reviews: published and waiting tiles are now `StatTile` filters, rows-per-page is wired (also Shopify import runs).
- Provider overview pages use `StatusChip`; hardcoded hrefs in app, courier and payment connector pages moved
  to `routes` (sweep counts lowered).

## Not done (no data or backend)
- "Recommended for <store>", ratings, pricing, screenshots, reviews, update available, disable, usage and
  billing, recent activity, languages: the registry has none of this.
- Error / disabled / update-available installed-app states: no such data.
- GST invoices, back in stock, forms and EMI pages keep their current layout (they already use the shared
  tokens); only links changed.
- Not looked at in a browser (no local login).
