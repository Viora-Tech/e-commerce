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

## Not done (no data or backend)
- "Recommended for <store>", ratings, pricing, "Free" / "Works with COD" / "Hindi ready" filters, update
  available, disable, usage and billing, recent activity: the registry has none of this.
- Listing page, 3-step setup wizard and success page: the existing per-app connect pages are unchanged.
- Per-app page redesign (Reviews, GST, courier and payment connect/overview pages) not restyled.
- Not looked at in a browser (no local login).
