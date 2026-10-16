import {
  columnOrderingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
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
 * so only sorting, selection, column visibility and column order run in the browser.
 */
export const resourceTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

export type ResourceTableFeatures = typeof resourceTableFeatures
