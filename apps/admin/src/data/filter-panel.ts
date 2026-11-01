/** Copy shared by the global filter panel and its applied-filter chips. */
export const filterPanelContent = {
  heading: 'Filters',
  clearAll: 'Clear all',
  /** A chip's popover: empties just that filter. */
  clear: 'Clear',
  any: 'Any',
  min: 'Min',
  max: 'Max',
  /** The footer button on lists that show a total: "Show 12 results". */
  show: (n: number) => `Show ${n} ${n === 1 ? 'result' : 'results'}`,
  /** The search box of a long list (vendors, tags). */
  search: 'Search',
  noMatches: 'No matches',
  /** A long list's chip after the first two values: "Asus, Logitech +3". */
  more: (n: number) => `+${n}`,
  yes: 'Yes',
  no: 'No',
  /** The date preset that opens From and To, and their labels. */
  custom: 'Custom range',
  from: 'From',
  to: 'To',
  /** A date group's "no filter" choice and the usual look-back presets. */
  anyDate: 'Any date',
  lastDays: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
  /** A range chip's value: both ends, or one open end. */
  range: {
    between: (from: string, to: string) => `${from}–${to}`,
    atLeast: (from: string) => `≥ ${from}`,
    atMost: (to: string) => `≤ ${to}`,
  },
} as const
