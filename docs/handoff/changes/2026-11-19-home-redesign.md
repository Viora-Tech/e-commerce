# Home redesign (approved 19 Nov)

Owner approved Figma "Home · Redesign 19 Nov (review)" (file `YmMNC5JOimqg61sI0eFI5a`, frame
`1044:11219`; wide screen `1050:11573`) on 19 Nov 2026. Branch `feat/home-redesign`. No migration.

- **Order** (`apps/admin/src/components/home/dashboard-page.tsx`): greeting, Ask AI, sales card,
  Finish setup (only while open), Needs you, Latest orders + Live now, Ideas for your store,
  How you're doing (open, no longer the collapsed "More numbers"), monthly goal row. Page stays
  the 68rem `PageBody width="settings"` column.
- **Needs you** (`needs-you.tsx`, was `todo-cards.tsx`): tiles 4 across from `xl`, buttons at the
  foot, "Oldest N days" on Ship, red "N out of stock" on Restock. Under them: Store health as one
  slim row (`store-health-row.tsx`, replaces the card) and "N orders are older than 30 days and
  still say To ship" (only when N > 0). Its button opens the Unfulfilled list filtered to orders
  placed up to that day (`?status=unfulfilled&date=custom:..yyyy-mm-dd`). **Not built yet:** the
  bulk "Mark as shipped elsewhere" action; the button only opens the list.
- **One to-ship count**: the greeting's "N need shipping", the Ship tile, its age and the Needs
  you heading all read `summary.needsYou.ordersToShip` (`ship-age.ts`). Ideas drops the
  `old_unfulfilled` and `restock_bestseller` smart cards (they repeated Needs you jobs and came from
  the daily card snapshot, so their numbers drifted: 66/92 vs 62/91 days on live).
- **New API** `dashboard.summaryExtras` (`packages/api/src/services/home-facts.service.ts`): old
  to-ship orders, products out of stock, and the last 30 days by real payment method (the
  gateway's `payment.method_detail.kind` first, then `order.payment_method`). Kept out of
  `dashboard.summary` so the SQL parity test against the legacy summary is untouched.
- **How you're doing** (`charts/charts-panel.tsx`): the sub-line names the exact dates compared;
  What changed (`charts/what-changed.tsx`) follows the 7/30/90 switch, every line says its period,
  the best seller is by sales and also names the most units (from the range's top five by sales).
  Top products, payments, statuses and states are labelled bars (`charts/labelled-bars.tsx`);
  recharts plots for those and the donuts are gone.
- **Monthly goal** (`sales-goal-row.tsx`, was the ring card): one slim row; whole rupees.
- **Store health** (`packages/core/src/store-health/checks.ts`): `zones_overlap` names each zone
  once and carries the `place` they cover, so it reads "India is in three delivery zones (Domestic
  and India)" instead of "Domestic, India, India". The count is the number of zones.
- Copy: `apps/admin/src/data/home-sections.ts` (+ `data/hi/home-sections.ts`) for the new parts;
  dead keys (More numbers, the old insights list, the ring's lines) removed from `data/home.ts`.
