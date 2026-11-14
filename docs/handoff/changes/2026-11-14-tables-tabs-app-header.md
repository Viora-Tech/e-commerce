# Tables, tabs and the app page header (design audit wave 2, steps 13 to 15)

Branch `design/tables-tabs-appheader` (from `origin/dev` ce218b3bc). Visual consistency only; no
data, permission or route changes. Audit: section 6.2, steps 13 to 15 (sections 2.3 and 2.9).

## Step 13: tables

- New `components/table/simple-table.tsx`: a small fixed table drawn like `ResourceTable`. Same
  2.5rem header with 0.75rem muted labels (`HEAD` from `resource-table/styles.ts`), the same
  3.75rem rows and 0.75rem sides, hairlines between rows. Pass `columns` (`key`, `label`,
  `align`, `className`) and body rows of `TableRow`/`TableCell` (or `LinkRow`).
  `density="compact"` gives 2.5rem rows for a table in a popup, a popover or a statement card.
  Body cell sizes come from the table (`SIMPLE_BODY` in `styles.ts`), so a row cannot drift. A cell
  with `colSpan` (the empty line, a reveal row) keeps its own spacing.
- KitTable is gone (`kit/kit-table*.tsx`, 3 files deleted). Its 5 users (Search app:
  recommendation stats, recommendations list, search queries; Search Console: stats table,
  losing traffic) now use SimpleTable. The green header band and the 4.25rem grid rows are gone.
- 8 of the 9 raw `<table>`s use SimpleTable: activity dialog (compact), sales breakdown (compact),
  delivery routes, Try a PIN trace (compact), catalog prices, largest files, UPI compare popover
  (compact), sales channel orders.
- The app tables that share `apps/gst-invoices/table-classes.ts` (20 files: GST invoices, queue,
  periods, returns, products tax; COD/RTO overview, risky orders, return reasons; affiliates
  overview, payouts, trend; back in stock; Delhivery pickup locations and shipments; MCP tokens
  and connected apps) now use the list measurements: header `HEAD`, rows 3.75rem (were 3rem),
  sides 0.75rem (were 1rem), border colour `border`.
- Shipments NDR and Pickups tabs use SimpleTable (they had the bare shadcn header and 2.5rem rows).
  The NDR "Actions" header was hard-coded English; it is now `shipmentsContent.ndr.columns.actions`.

Left alone, on purpose:
- `shipments/create-shipment/courier-table.tsx`: the Select courier drawer follows its own Figma
  frame (898:7790). Its rows are a picker with an inline price reveal, and squeezing them to list
  rows would change an agreed money-flow design.
- No list moved to `ResourceTable`. None of the app lists has a server search with totals, so
  moving them would add a search and filter bar the owner has not seen. SimpleTable gives them the
  same header and rows. Where search or paging is wanted, that is a page PR (audit section 7, #6
  and #14).
- About 25 other hand-composed `ui/table` files (growth, billing, platform, settings table, bulk
  ship, variant matrix) are for the page-by-page pass (audit section 7).
- `text-kit-head` / `text-kit-cell` in `packages/ui/src/styles.css` are no longer used by the table.
  `text-kit-cell` is still used by `inventory/available-cell.tsx`. The tokens step owns that file.

## Step 14: tabs

- `layout/pill-tabs.tsx` additions (all optional, existing callers unchanged): `href` per tab
  (link tabs render as `<nav>` with `aria-current`), `id` and `controls` per tab (real tab
  panels), `label` (aria-label), `fill` (equal-width tabs), `roving` + `onKeyDown` (only the open
  tab is in the Tab order, arrow keys move). `onChange` is optional for link tabs.
- `products/product-tabs.tsx`: the "tabs" strip is PillTabs `underline` (keeps arrow keys, ids,
  panels, counts and the error and warning dots). The "settings" rail look is unchanged.
- `settings/section-tabs.tsx`: PillTabs `underline` (was its own h-9 strip with a green rule).
- `platform/platform-tabs.tsx`: a thin wrapper on PillTabs link tabs.
- `themes/customize/segmented-tabs.tsx` deleted; Sections | Audit and Basic | Advanced use PillTabs
  `segmented fill`.
- The 10 direct `ui/tabs` users use PillTabs. Switches inside dialogs and cards use `segmented`,
  the two `variant="line"` strips (Shopify import samples, MCP connect guide) use `underline`.
  Shopify import's connect form and the DNS help popover render the open panel themselves (the
  same as before, since Base UI unmounted hidden panels).
- `ToggleGroup` (packages/ui) has a new `variant="segmented"` with the PillTabs segmented look:
  muted track, 1.875rem options, raised pressed option. 27 option switches in 25 files use it.
  Three choice rows that wrap or form a grid stay `outline`: payment gateway filters, AI writer
  tone, checkout font.
- Not changed: `themes/code/code-tabs.tsx` (editor file tabs) and
  `gift-cards/gift-card-state-tabs.tsx`. The audit did not ask to merge these.

## Step 15: app page header

- `apps/app-shell.tsx` draws `PageHeader`: "‹ Apps" back link (was the "Apps / Name"
  breadcrumb), the 3rem app logo as the lead, the name at the page-title size (was 1.25rem), the
  status chip at its normal size (was forced to `h-5 text-xs`), then the status pill, the app's
  action and the "…" menu on the right. The rule under the old bar is gone, as on every other page.
- The in-page AppNav is still `md:hidden` (phones only); on desktop the app's pages stay in the
  main sidebar (#1698).

## Tests

New `table/simple-table.test.tsx` and `layout/pill-tabs.test.tsx`.
