import {
  columnOrderingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * TanStack v9 registers features explicitly; unused ones are tree-shaken.
 * Filtering and paging are server-side (the API takes page/perPage/search),
 * so only sorting, selection, column visibility, column order and expanding (tree tables, whose
 * sorting keeps each row's sub rows under it) run in the browser.
 */
export const resourceTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  expandedRowModel: createExpandedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

export type ResourceTableFeatures = typeof resourceTableFeatures
