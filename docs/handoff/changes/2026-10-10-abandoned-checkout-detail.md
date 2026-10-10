# Abandoned checkout detail page

Branch `feat/abandoned-checkout-detail`. No migration; read-only data from `cart` / `cart_line`.

- New page `/orders/abandoned-checkouts/[id]` (`components/abandoned/abandoned-detail.tsx` and four card files): cart lines with photos and prices, totals, customer, reminder state, activity (started, last active, reminder sent, recovered). Header: Copy cart link (fresh signed recovery URL), Send reminder / Send again (reuses `orders.sendRecovery`, needs `orders:write`).
- New `orders.getAbandoned` procedure (`getStoreAbandoned` in `draft.service.ts`), NOT_FOUND via RLS. Test: `packages/api/test/abandoned-detail.test.ts`.
- List rows now link to the detail page, plus a "View checkout" row-menu item.
- Not in the data, so not shown: city, shipping amount, per-event activity (only cart start / last touch / reminder / recovery timestamps exist), channel picker and message preview from Figma (the existing reminder sends on every enabled channel).
- Copy: `data/abandoned-detail.ts` + Hindi overlay. Route: `routes.orders.abandonedCheckout`.
- Figma: Orders / Abandoned checkout detail / Default (342:7848). Not checked in a browser (Chrome extension not connected in this session).
