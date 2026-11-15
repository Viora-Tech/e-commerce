# Docs: real screenshots in the merchant guide

The merchant guide's `<Screenshot>` placeholders now show real captures of the admin, taken from a
fictional local store, "Asha Handlooms" (owner `asha@example.in`, Jaipur, handloom products). No
Waimers or other real store data is in any image. Branch `docs/real-screenshots`.

- `apps/docs/components/screenshot.tsx`: at build time (static export) it looks for
  `public/screenshots/<slug>.webp` (slug of `name`, `screenshotSlug`) and, in dark mode,
  `<slug>.dark.webp`; it falls back to the grey placeholder when the file is missing. The caption
  is also the alt text. Dark/light switch is Tailwind `in-[.dark]:…` on Nextra's `.dark` class.
- `apps/docs/scripts/screenshots/seed.ts`: fills a separate local database `commerce_shots`
  (refuses any other) with the demo store: 12 products with drawn woven-pattern photos, the repo's
  demo orders/customers/drafts/carts and Growth sessions pointed at it, order #1042 shaped as the
  guide describes (Kantha throw, ₹2,499, CGST 9% + SGST 9%), a verified `ashahandlooms.in` domain,
  the live theme and a Minimal preset theme.
- `apps/docs/scripts/screenshots/capture.ts`: Playwright on Google Chrome (the bundled headless
  shell cannot show the GST invoice PDF preview), 1440 wide at 2x, light and dark, WebP under
  ~300 KB. Signs in with the dev OTP route and caches the session in
  `apps/docs/node_modules/.cache/`.
- `apps/docs/scripts/screenshots/migrate.ts` creates and migrates `commerce_shots` in chunks of 30
  migrations: the whole history in one transaction runs out of locks on the shared container
  (`max_locks_per_transaction` 64). For that `runMigrations` (`packages/db/src/migrate.ts`) takes
  an optional `migrationsFolder`.
- `packages/db` demo seeds `seedDemoOrders` / `seedDemoDrafts` take an optional `storeSlug`
  (default `waimers`, so `bun run db:seed:demo` is unchanged).
- `apps/docs` gains `sharp` as a dev dependency (photo drawing and WebP).
- Captions were edited where the real screen differs from the planned one (for example the
  sections ⋯ menu has more items, the GST preview shows its built-in sample invoice, the Add
  panel's Apps group now sits under Blocks).

How to rerun: `apps/docs/README.md` → "Updating screenshots".

**Still placeholders** (cannot be reached with local demo data):
- Delhivery connection form: Test connection needs a live Delhivery account.
- Create shipment, Courier step: needs live courier rate quotes.
- Settings → Payments: Razorpay verifies the keys before saving, so a connected Test-mode
  gateway needs real Razorpay test keys.
