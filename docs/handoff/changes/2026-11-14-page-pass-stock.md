# Page pass 7: Stock (inventory, purchase orders, transfers, inbound shipments, suppliers)

Audit section 7, row 7. Visual and state consistency only; quantities, costs and flows are unchanged.

## Already done before this pass (checked, left alone)

- Wave 2: no KitIconButton or KitSearch left in stock; the variant, supplier and purchase-order
  pickers are on RecordCombobox; every stock dialog is on the dialog shell with `busy` and a
  spinning submit; every card except two was already a DataCard; PageColumns is 23.5rem.

## Lists (5)

- **Failures show in the table.** Inventory, purchase orders, transfers, inbound shipments and
  suppliers now show "Could not load the …" with Try again in the table body when a refetch
  (search, filter, page, tab) or a refresh after a row action fails, like Orders. Before, the old
  rows stayed and the error was swallowed.
- **Skeletons match the page.** Each list has its own `loading.tsx` skeleton built from the real
  ResourceTable in its loading state (real title, header labels, column widths, view select and
  filter button). Inventory's skeleton also draws the Location / Show / Reason row that was
  missing. `ListPageSkeleton` gained an optional `controls` slot for that row.
- Inventory: Export has its own busy key and spins; it no longer greys out the bulk buttons.
- Inventory's filter groups moved to `inventoryFilterGroups` in `inventory-query.ts` so the page
  and the skeleton share them (same filters, same URL patches).
- Transfers with one location: the "add a second location" panel is `EmptyState variant="page"`
  (was a raw Card around a section EmptyState).
- Copy: the transfer columns, the transfer form and its cards, the inventory bulk bar, bulk
  dialog, history dialog and location picker read copy through `useCopy`, so the Hindi overlay
  applies where it exists.

## Forms (purchase order, transfer, supplier, inbound shipment)

- All four are on `ProoflyDetailPage` (PageBody `detail` + PageColumns), the product-page
  template, instead of a hand-built ProoflyPageBody + PageHeader + PageColumns. Same widths.
- Their `loading.tsx` use `DetailPageSkeleton frame="detail"` with the page's own number of
  header buttons and main/side cards (new and existing differ).
- Delete in the header is an outline button on all four (supplier and inbound shipment had a red
  ghost button).
- Purchase order: Reopen spins while it runs.
- Inbound shipment: the Purchase orders card is a DataCard (was a raw Card), with a count pill like
  the transfer lines card.
- Documents card: the "Type" label is a Field label tied to its select.

## Shared files touched

- `components/layout/list-page-skeleton.tsx`: optional `controls` prop (backward compatible).
- `components/purchase-documents/documents-card.tsx` (used only by stock pages).

## Not done

- `transferFormContent` has no Hindi overlay yet (it now reads through `useCopy`, so adding one
  in `data/hi/inventory.ts` is enough).
- The PO and transfer line rows stay hand-built grids of inputs (editable rows, not a table).
- `available-cell.tsx` keeps its module-scope English labels (screen-reader labels on +/-).
