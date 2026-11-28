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

/**
 * `SimpleTable`'s body cells, set from the table so plain `TableRow`/`TableCell` rows get the list
 * table's 3.75rem rows and 0.75rem sides without each file repeating them (`list`), or 2.5rem
 * rows for a small table inside a popup or a statement card (`compact`). A cell that spans the
 * row (`colSpan`: the empty line, a reveal row) keeps its own spacing.
 */
export const SIMPLE_BODY = {
  list: '[&_tbody_td:not([colspan])]:h-15 [&_tbody_td:not([colspan])]:px-3 [&_tbody_td:not([colspan])]:py-1.5 [&_tbody_th]:h-15 [&_tbody_th]:px-3 [&_tbody_th]:py-1.5',
  compact:
    '[&_tbody_td:not([colspan])]:h-10 [&_tbody_td:not([colspan])]:px-3 [&_tbody_td:not([colspan])]:py-1.5 [&_tbody_th]:h-10 [&_tbody_th]:px-3 [&_tbody_th]:py-1.5',
} as const

/**
 * `fill` (lib/page-fill): from `md` the card fits the page's height and only the rows scroll.
 * The card shrinks to the room left under the page header (a short list stays short), but never
 * below 16rem: with banners that leave less, the page scrolls as before. The toolbar and the
 * pager keep their rows; the grid scrolls both ways in one scroller, so the header row sticks
 * on top of it with a rule under it (the first row drops its own). Phones scroll the page.
 */
export const FILL = {
  card: 'md:min-h-64',
  frame: 'md:flex md:min-h-0 md:flex-col',
  scroller:
    'md:min-h-0 md:overflow-auto md:overscroll-contain md:[&_[data-slot=table-container]]:overflow-visible md:[&_tbody>tr:first-child>td]:border-t-0',
  head: 'md:sticky md:top-0 md:z-1 md:bg-card md:shadow-[inset_0_-0.0625rem_0_var(--border)]',
} as const
