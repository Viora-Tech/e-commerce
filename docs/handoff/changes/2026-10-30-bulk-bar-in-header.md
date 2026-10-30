# Bulk bar in the table header (2026-10-30)

From the side-by-side audit with Shopify: the bulk actions moved from the floating bar at the
bottom into the table's header row.

## What changed

- `ResourceTable` (`components/table/resource-table/`): while rows are ticked, the header row
  turns into the bulk bar (`selection-bar.tsx`): the page checkbox, "N orders selected ▾"
  (Select all on this page / Select all N matching / Clear selection), the list's
  `bulkActions`, and a "Show all selected" toggle that filters the loaded rows to the ticked
  ones (a tree row stays while any sub row is ticked). The bar sits outside the sideways
  scroller, so it stays in view on narrow screens; the header cells underneath are `inert`.
- The floating bar is gone from lists (`FloatingBar` stays for the save bar). The `bulkMore`
  prop is removed: each list's `bulkActions` puts its main actions as buttons and the rest in a
  "More actions" menu.
- Products: Bulk edit, Set as active, Set as draft as buttons; Add tag, Add to collection,
  Write with AI, Archive, Export, Run automation and Delete in More actions
  (`ProductBulkMore` merged into `ProductBulkActions`).
- Customers: Bulk edit, Add tag ▾, Marketing ▾ as buttons; Export, Email, Run automation and
  Delete in More actions. `RunAutomationButton` (no longer used) is deleted.
- Reviews and metaobject entries: their bulk buttons fit the 40px bar (no wrapping div,
  `size="sm"`).
- Every other list (Orders, Drafts, Abandoned, Returns, Collections, Gift cards, Inventory,
  Purchase orders, Discounts, Blog posts, Installed apps, Automations, Links, Redirects,
  Shipments) shows its existing actions in the header bar unchanged; confirm dialogs (bulk
  Cancel orders etc.) still ask first.

## Phone width

The actions strip scrolls sideways inside the bar, and "Show all selected" moves into the
selection menu. Lists with many actions already keep the rest in More actions.

## Tests

`components/table/resource-table/bulk-bar.test.tsx`: the header becomes the bar, an action
gets the ticked ids and clears, and "Show all selected" filters and restores the rows.
