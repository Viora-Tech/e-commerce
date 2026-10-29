# Admin filters F4: Customers and Discounts

Phase F4 of the admin filters plan, on the shared panel from F1 (#891) and the URL pattern
from F2 (#910). Every filter is applied on the server and combines with search, the tab and
paging.

- **Customers** (`apps/admin/src/lib/customer-list-filters.ts`, replaces
  `app/(admin)/customers/customer-filter-state.ts`): the filters now live in the URL (they were
  `useState`, lost on reload or share). State and Tag are multi-picks; Spend and Orders are
  min/max ranges; Customer since and Last order are date ranges (7/30/90 days or custom);
  Email, SMS and WhatsApp marketing and Business (GSTIN) are yes/no. URL keys: `state`, `tag`,
  `spendMin`, `spendMax`, `ordersMin`, `ordersMax`, `created`, `lastOrder`, `email`, `sms`,
  `whatsapp`, `business`. The panel's copy now follows the member's language (it read the
  English copy directly before).
- **Customers API**: `customers.list` and `customers.export` take `stateCodes`, `tags` (any of),
  `maxOrders`, `acceptsSms`, `acceptsWhatsapp`, `createdFrom/To` and `lastOrderFrom/To`
  (`[from, to)`; a customer with no orders never matches a last-order window). The old single
  fields still work.
- **Save as segment** maps what a segment can express: one state or tag (several are dropped,
  segments match every condition), spend and order bounds, a Last order preset as
  `last_order_days`, email marketing and business. SMS, WhatsApp and Customer since have no
  segment condition yet.
- **Discounts** (`apps/admin/src/lib/discount-list-filters.ts`, `discounts-page.tsx`): a filter
  panel (there was none): Status (active, scheduled, expired, disabled), Type (the four
  Shopify types), Method (code, automatic), Active dates (ran at some point in the window),
  Times used (min/max) and Usage limit reached (yes/no). URL keys: `lifecycle`, `type`, `kind`,
  `active`, `usedMin`, `usedMax`, `limitReached`; the tab stays `?status=`. Filtered with no
  rows shows "No discounts match these filters".
- **Discounts API**: `discounts.list` takes `lifecycles`, `types`, `kinds`, `activeFrom/To`,
  `usedMin/Max` and `limitReached`.
- Copy in `data/customers.ts`, `data/discounts.ts` and their `data/hi/` overlays.
- Tests: `apps/admin/src/lib/customer-discount-list-filters.test.ts` (parsing and segment
  rules), `packages/api/test/customer-discount-list-filters.test.ts` (each server filter, with
  search, tab and paging, and export).

No migration.
