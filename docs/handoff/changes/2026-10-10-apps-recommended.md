# Apps home: "Recommended for <store>"

Branch `feat/apps-recommended`. No migration, no API change.

- New strip on Apps home (`components/apps/apps-recommended.tsx`): up to 3 not-installed apps for what the store lacks. Rules live in `lib/apps-recommended.ts` (no courier suggests Delhivery, then Shiprocket / RapidShyp; no reviews suggests Reviews; no WhatsApp; GST invoices; back in stock; payments). A gap counts as covered when any listed app is installed or any installed app provides that kind. Tests: `lib/apps-recommended.test.ts`. Install reuses the existing install dialog.
- Reasons per app and the Hindi overlay are in `data/apps.ts` / `data/hi/apps.ts` (`recommended`). The store name comes from `api.store.current()`; the strip waits for it.
- "Billing and usage" button NOT built: there is no billing, plan or usage route anywhere in the admin yet (`lib/routes.ts`, settings sections). Add it next to "Browse App Store" when that page exists.
- Not in the data, so not shown: star ratings and per-app pricing lines from the Figma cards.
- Figma: Apps / Apps home / Default (328:21275). Not checked in a browser (Chrome extension not connected in this session).
