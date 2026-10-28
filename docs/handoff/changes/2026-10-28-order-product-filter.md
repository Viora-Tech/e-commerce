# Orders list: a Product filter that combines with the others (#884)

A merchant could not find "PD170 orders still to pack": the Orders filter panel had Payment,
Fulfilment, Date, Payment method and Courier, but nothing for the product, and the search box
only matches order number, email and customer name.

- **API** (`packages/api`): `orders.list` and `orders.ids` take `product` (text, up to
  `SEARCH_MAX`). `orderListWhere` in `services/order.service.ts` keeps an order when one of its
  lines has the text in its title as sold, its variant title, or the variant's SKU
  (`exists` over `order_line` + `variant`, `ilike`, with `%`/`_` escaped). It is ANDed with every
  other filter, the tab and the search, so "Select all N orders" uses it too.
- **Filter panel** (`apps/admin/src/components/table/filter-panel`): a new `text` group type
  (`TextGroup`, `text-section.tsx`): one input, its chip shows the text, Clear all empties it.
  Any list can use it.
- **Orders** (`apps/admin/src/lib/order-list-filters.ts`, `app/(admin)/orders/orders-page.tsx`):
  a Product group first in the panel, kept in the URL as `?product=`; copy in `data/orders.ts`
  and `data/hi/orders.ts`.
- Tests: `packages/api/test/orders-status-split.test.ts` (product alone, with fulfilment, with
  payment method, `%` literal, `orders.ids`); `apps/admin/src/lib/order-list-filters.test.ts`.
- Merchant guide: Orders → "Pick a tab" explains combining filters.

No migration. Picking a tab still clears the panel's filters (unchanged).
