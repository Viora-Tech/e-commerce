# Dev checks after the admin redesign (2026-10-10)

The redesign PRs (#302–#314) merged after lint + typecheck only. The full run on dev found these and they are fixed here:

- Build: `shopify-import/imports-page.tsx` had `;('use client')` after an import (a bad codemod), so the admin build failed. The directive is back at the top.
- Test: `lib/i18n.test.ts` expected "Today, 4:00 pm"; the shell PR intentionally dropped the comma (`formatWhen`). Test updated (English and Hindi).
- Sweep date-format: `home/sales-hero.tsx` now uses `useFormat().pattern`.
- Sweep duplicate-helpers: `home/latest-orders.tsx` imports `initials` from `lib/initials`.
- Sweep hardcoded-colours: `apps/app-logo.tsx` is allow-listed (per-app brand gradients, no theme role fits).
- Sweep file-size: `data/products.ts` split (form copy now in `data/product-form.ts`); `product.service.ts` split (stats and stock history now in `product-stats.service.ts`).
- Sweep no-orphans: `LOW_STOCK_AT` is now imported, so its allow-list entry is removed.
- Sweep site-config (after #315/#316): `data/theme-import.ts` and its Hindi overlay spelled the brand name; they read `siteConfig.brand.name` now.
