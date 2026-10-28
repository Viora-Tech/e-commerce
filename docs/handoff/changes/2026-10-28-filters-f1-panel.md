# Filters F1: three new filter types, and Orders filters that stay put

Owner, 28 Oct: "the filter problem is everywhere, not just in orders". Audit and plan F1–F5 in
the owner's memory (`admin-filters-plan`); this is F1, the shared part, used first on Orders.

## Shared filter panel (`apps/admin/src/components/table/filter-panel/`)
- `multi`: several values out of a long list (vendors, tags, states). A search box shows once a
  list has more than 6 options; ticked values stay on top; the chip reads "Asus, Logitech +1".
- `date`: Any, the group's presets, or **Custom range** with From and To date fields (either
  open). Value `{ preset, from, to }` (`DateFilterValue`, `DATE_CUSTOM`).
- `boolean`: Any / Yes / No as one segmented control (GST number given, has photos, subscribed).
- Chips and Clear all handle all three (`applied.ts`). Copy: `data/filter-panel.ts` and the
  Hindi overlay.
- `lib/date-filter.ts`: `parseAsDateFilter(presets)` keeps a date filter in the URL (`7d`, or
  `custom:2026-10-01..2026-10-28`), `hasDateFilter`, `dateFilterBounds` (a custom range runs from
  the start of its first day to the end of its last day, in the merchant's time).

## Orders
- Date is the new `date` type: Today, last 7/30/90 days, or a custom range. `orders.list` and
  `orders.ids` take `placedTo` next to `placedFrom` (MCP action docs regenerated).
- Picking a tab (All, Unpaid, Unfulfilled…) no longer clears the panel filters: they combine.
  The view picker then shows the tab's name with the filtered count instead of "Custom".
- Merchant guide (Orders): custom range and tabs keeping filters.

Next: F2 products, inventory, collections, gift cards (they adopt `multi`, `date`, `boolean`).

Tests: admin `lib/date-filter.test.ts` (URL form, bounds), `filter-panel/applied.test.ts` (chips
and clear for the new types), `lib/order-list-filters.test.ts` (custom range input); api
`orders-status-split.test.ts` (a placed-at window, both ends, with a status). Typecheck admin and
api; component checker 0 errors; sweeps 26/26.
