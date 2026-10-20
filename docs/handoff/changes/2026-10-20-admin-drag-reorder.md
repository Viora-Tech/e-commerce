# Admin lists reorder by drag and drop, not arrow buttons

Branch `feat/admin-drag-reorder`. No migration, no API change: each list saves the same data
through the same call as before; only the interaction changed.

- Every list that had "Move up" / "Move down" arrows now drags by a grip (`GripVertical`) on the
  left, with mouse, touch (short hold) or keyboard (space to pick up, arrows, space to drop) and
  screen reader announcements. Converted: Settings › Locations (order still saves on drop via
  `reorderLocations`), metaobject definition fields, group row fields (field dialog), group
  rows (entry form, product metafields), storefront footer menu columns, email blocks
  (campaigns and automation emails), automation steps (dragged on the flow canvas; the step
  card lost its arrows), GST invoice review order.
- Built on the shared `@commerce/ui/sortable` (`SortableList`, `DragHandle`, `useDndSensors`,
  `sortTransition`); no change in `packages/ui`.
- New `components/layout/sortable-stack.tsx`: the same sensors, timing and announcements, but
  the row itself follows the pointer instead of `SortableList`'s fixed overlay. Use it inside a
  dialog (its `translate` makes a fixed overlay land in the wrong place) or on a zoomed canvas
  (`scale` divides the shift). Used by the group row fields editor and the automation flow.
- `LocationOrderRow` (`settings/locations/`) is the sortable table row; `SettingsTableRow`
  now takes an optional `ref` and `style` for it.
- `hooks/use-row-ids.ts` gives rows with no id of their own (group rows, footer columns) a
  stable id so a drag can follow them.
- Copy: one shared `reorderLabels` in `data/common.ts` (Hindi in `data/hi/common.ts`); the old
  `moveUp`/`moveDown` keys were removed. The theme editor's canvas block toolbar keeps its
  up/down buttons (it moves blocks on the canvas, not a list).
- Not run: lint, typecheck, build (owner's request). Check by hand in the browser.
