/**
 * Two drawings of the same table. `compact` is the Shopify-density scale used by
 * products, customers and pages. `frame` is Dealport 5:2560 at its own px:
 * 24px card inset, 40px toolbar controls, 56px header band, 68px rows, 36px page squares.
 */
export type ResourceTableSize = 'compact' | 'frame'

export type ResourceTableMetrics = {
  card: string
  gapAfterToolbar: string
  search: string
  searchInput: string
  iconButton: string
  head: string
  headText: string
  cell: string
  skeletonCell: string
  bulkBar: string
  pageEdge: string
  pageSquare: string
  paginationGap: string
}

export const RESOURCE_TABLE_METRICS: Record<ResourceTableSize, ResourceTableMetrics> = {
  compact: {
    card: 'p-5',
    gapAfterToolbar: 'mt-5',
    search: 'h-8 w-60 rounded-lg py-1 pr-2 pl-3',
    searchInput: 'text-body',
    iconButton: 'size-8 rounded-[0.25rem] [&_svg]:size-4',
    head: 'h-10 px-2.5 py-1 first:rounded-l-[0.375rem] first:pl-4 last:rounded-r-[0.375rem] last:pr-4',
    headText: 'text-table-head',
    cell: 'h-12 px-2.5 py-2 text-body first:pl-4 last:pr-4',
    skeletonCell: 'h-12 px-2.5',
    bulkBar: 'mt-4 px-4 py-2 text-body',
    pageEdge: 'h-8 rounded-lg px-2 text-xs [&_svg]:size-4',
    pageSquare: 'size-8 rounded-[0.25rem] text-xs',
    paginationGap: 'mt-8',
  },
  frame: {
    card: 'p-6',
    gapAfterToolbar: 'mt-10',
    /* 5:2572: 264 x 40, 12px inset, glyph on the right. */
    search: 'h-10 w-[16.5rem] rounded-[0.25rem] py-2 pr-2 pl-3',
    searchInput: 'text-kit-cell',
    /* 5:2576: 40px square, 20px glyph. */
    iconButton: 'size-10 rounded-[0.25rem] [&_svg]:size-5',
    /* 5:2591: 56px band, cells 40px tall inset 8px, 6px corners. */
    head: 'h-14 px-3 py-2 first:rounded-l-[0.375rem] first:pl-4 last:rounded-r-[0.375rem] last:pr-4',
    headText: 'text-kit-body font-medium',
    /* 5:2606: 68px rows on a hairline, 14px ink. */
    cell: 'h-[4.25rem] px-3 py-3 text-kit-cell first:pl-4 last:pr-4',
    skeletonCell: 'h-[4.25rem] px-3',
    bulkBar: 'mt-6 px-5 py-3 text-kit-cell',
    /* 5:2856: 42px edge buttons, 24px arrow; 5:2865: 36px squares. */
    pageEdge: 'h-[2.625rem] rounded-[0.25rem] px-2 text-kit-body [&_svg]:size-6',
    pageSquare: 'size-9 rounded-[0.25rem] text-kit-body',
    paginationGap: 'mt-[3.125rem]',
  },
}
