/** Copy shared by every ResourceTable in the admin. */
export const tableContent = {
  search: (plural: string) => `Search and filter ${plural}`,
  number: 'No.',
  filter: 'Filter',
  sort: 'Sort',
  sortBy: 'Sort by',
  columnsTitle: 'Columns',
  reset: 'Reset',
  views: 'Views',
  saveView: 'Save as new view',
  clearSort: 'Clear sort',
  more: 'More',
  clearFilters: 'Clear all',
  /** The search bar's placeholder once filter pills sit in it. */
  searchMore: 'Search',
  /** An applied-filter chip: "Payment is" before the bold value. */
  filterIs: (field: string) => `${field} is`,
  /** A picker's Is not: "Product is not …". */
  filterIsNot: (field: string) => `${field} is not`,
  view: 'View',
  toggleColumns: 'Toggle columns',
  sortAsc: 'Sort ascending',
  sortDesc: 'Sort descending',
  hideColumn: 'Hide column',
  selectAll: 'Select all',
  selectRow: 'Select row',
  selected: (n: number, singular: string, plural: string) =>
    `${n} ${n === 1 ? singular : plural} selected`,
  clearSelection: 'Clear',
  /** The selection bar's offer once the whole page is ticked. */
  selectAllMatching: (n: string, plural: string) => `Select all ${n} ${plural}`,
  allSelected: (n: string, plural: string) => `All ${n} ${plural} selected`,
  /** The bulk bar's "3 orders selected ▾" menu. */
  selectionMenu: 'Selection options',
  selectPage: 'Select all on this page',
  clearAllSelected: 'Clear selection',
  /** The bulk bar's toggle: only the ticked rows, then back to every row. */
  showSelected: 'Show all selected',
  showAllRows: 'Show all rows',
  removeFilter: (label: string) => `Remove ${label}`,
  showing: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
  rowsPerPage: 'Rows per page',
  open: 'Open',
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  previousLabel: 'Previous',
  nextLabel: 'Next',
  ellipsis: '.....',
  noResults: 'No results',
  previous: 'Previous page',
  next: 'Next page',
  emptyHeading: (plural: string) => `No ${plural} yet`,
  /** Figma "Feedback state · No results": a search found nothing; one button clears it. */
  noResultsBody: 'Nothing matches this search and these filters.',
  clearSearchAndFilters: 'Clear filters',
  /** Read out over a plain table's skeleton rows while its page loads. */
  loading: (plural: string) => `Loading ${plural}`,
  loadFailed: (plural: string) => `Could not load the ${plural}`,
} as const
