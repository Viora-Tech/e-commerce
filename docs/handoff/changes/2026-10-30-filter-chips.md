# Filter chips on admin lists (2026-10-30)

The crowded filter popover (every group stacked in one panel, "Show N" button) is gone. Lists now
filter Shopify-style, one filter at a time:

- **Filter** button beside the list search opens a short list of filter names (a tick marks the
  ones in use).
- Picking one adds its chip under the search and opens a small popover with just that filter's
  controls. Changes apply at once; closing it while still empty drops the chip.
- An applied filter is a pill ("Payment is Paid ×"). Clicking it reopens its popover (with
  **Clear**); × removes it. **Add filter** sits after the chips, **Clear all** shows for 2+.
- URL query params stay the source of truth: chips are derived from the same `FilterGroup`s the
  pages already build in `lib/*-list-filters.ts`.

## Code

- `ResourceTable` takes `filterGroups` instead of `filters` / `filtersClassName` / `applied`.
  The toolbar (`components/table/resource-table/toolbar.tsx`) owns the menu and chips:
  `filter-menu.tsx`, `filter-chip.tsx`.
- `components/table/filter-panel/`: `FilterPanel` replaced by `FilterControl` (one group's
  controls). `applied.ts` adds `hasFilter`, `chipGroups`, `clearGroup`, exports `chipFor`; the
  money fallback formats through `@commerce/money` (no hard-coded ₹). Tests: `chips.test.ts`.
- Pages moved to `filterGroups={groups}`: Orders, Drafts, Abandoned checkouts, Returns, Shipments,
  Products, Collections, Gift cards, Inventory, Purchase orders, Transfers, Suppliers, Inbound
  shipments, Customers, Discounts, Blog posts, Affiliates, Commissions, Pixel event log, Reviews,
  Automations (its "Made in" chip is now a select filter).
- New copy: `filterPanelContent.clear`, `automations list.originAny` (+ Hindi).

Not browser-tested (owner's PC busy): check the chip popover opening after picking from the menu,
on Orders and on a phone width.

- Later: the chips sit inside the "Search and filter" bar itself, before the text (Shopify
  style), not in a second row; the Filter button adds one. "Add filter" copy removed.
