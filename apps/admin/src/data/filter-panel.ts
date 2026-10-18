/** Copy shared by the global filter panel and its applied-filter chips. */
export const filterPanelContent = {
  heading: 'Filters',
  clearAll: 'Clear all',
  any: 'Any',
  min: 'Min',
  max: 'Max',
  /** The footer button on lists that show a total: "Show 12 results". */
  show: (n: number) => `Show ${n} ${n === 1 ? 'result' : 'results'}`,
  /** A range chip's value: both ends, or one open end. */
  range: {
    between: (from: string, to: string) => `${from}–${to}`,
    atLeast: (from: string) => `≥ ${from}`,
    atMost: (to: string) => `≤ ${to}`,
  },
} as const
