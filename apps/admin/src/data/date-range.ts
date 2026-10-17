/** The one date-range picker (Figma 580:692): presets, two months of calendar, compare. */
export const dateRangeContent = {
  ranges: {
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    thisQuarter: 'This quarter',
    thisFy: 'This financial year',
    diwali: 'Diwali week',
    festive: 'Festive season',
    custom: 'Custom range',
  },
  festiveHint: 'Sep–Nov',
  bigSale: {
    label: 'Big sale days',
    loading: 'Finding your best days…',
    empty: 'No orders in the last year yet.',
    failed: 'Could not load your best days.',
    line: (sales: string, orders: number) =>
      `${sales} · ${orders} ${orders === 1 ? 'order' : 'orders'}`,
  },
  rangeLabel: 'Date range',
  from: 'From',
  to: 'To',
  compareTo: 'Compare to',
  compareOptions: { previous: 'Previous period', year: 'Same dates last year' },
  cancel: 'Cancel',
  apply: 'Apply',
} as const
