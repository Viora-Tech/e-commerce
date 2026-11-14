/*
 * The list table's measurements, in one place so the table, its toolbar and the loading
 * skeleton (`table/resource-table-skeleton`) draw the same heights: a toolbar row of 2.25rem
 * controls on 0.5rem padding (3.25rem with its rule), a 2.5rem header and 3.75rem rows.
 * Figma "Table / Cell": header 12/16 regular muted; rows split by the border colour; 0.75rem sides.
 */

/** The toolbar's one row (view select, search and filter bar, sort and columns). */
export const TOOLBAR_ROW = 'flex flex-wrap items-center gap-2 py-2 pr-2 pl-1.5'

/** A toolbar control: 2.25rem, like Button, Select and Input. */
export const CONTROL_HEIGHT = 'h-9'

/** A header cell. */
export const HEAD =
  'h-10 bg-transparent px-3 py-0 text-period font-normal text-muted-foreground first:pl-3 last:pr-3'

/** A body cell: the row is 3.75rem tall. */
export const CELL = 'h-15 border-t border-border px-3 py-1.5 text-body first:pl-3 last:pr-3'

/** Placeholder rows when the table has no rows yet to keep the height of. */
export const SKELETON_ROWS = 6
