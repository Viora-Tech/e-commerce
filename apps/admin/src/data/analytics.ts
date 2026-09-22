import type { ReportCategory } from '@commerce/api'

/** Copy for the Analytics section. */
export const analyticsContent = {
  title: 'Analytics',
  intro: 'How the store is doing, from visitors to revenue.',
  ranges: {
    label: 'Date range',
    today: 'Today',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    custom: 'Custom',
    from: 'From',
    to: 'To',
    apply: 'Apply',
  },
  compare: 'vs previous period',
  kpis: {
    sessions: { label: 'Sessions', help: 'Unique visitors on the storefront.' },
    orders: { label: 'Orders', help: 'Orders placed, drafts and cancellations excluded.' },
    revenue: { label: 'Revenue', help: 'Order totals including tax and shipping.' },
    conversion: { label: 'Conversion rate', help: 'Orders divided by sessions.' },
    aov: { label: 'Average order value', help: 'Revenue divided by orders.' },
    returning: { label: 'Returning customers', help: 'Share of orders from repeat buyers.' },
  },
  salesOverTime: {
    title: 'Sales over time',
    day: 'By day',
    week: 'By week',
    series: 'Revenue',
  },
  topProducts: { title: 'Top products', empty: 'No sales in this range yet.', units: 'sold' },
  byState: { title: 'Sales by state', empty: 'No shipped orders in this range yet.' },
  paymentMethods: { title: 'Payment methods', empty: 'No payments in this range yet.' },
  funnel: {
    title: 'From visit to order',
    steps: {
      sessions: 'Sessions',
      carts: 'Carts created',
      checkouts: 'Checkouts started',
      orders: 'Orders placed',
    },
    ofSessions: 'of sessions',
    ofPeak: 'of the widest step',
    fromPrevious: 'from the step before',
    help: 'Sessions come from the storefront beacon, so this fills once the store has traffic.',
  },
  reports: {
    title: 'Reports',
    intro: 'Break sales down by product, place, discount and time.',
    open: 'Open report',
    soon: 'Not built yet',
    categories: {
      sales: 'Sales',
      orders: 'Orders',
      customers: 'Customers',
      products: 'Products',
      marketing: 'Marketing',
    } satisfies Record<ReportCategory, string>,
    columns: {
      label: 'Name',
      detail: 'Detail',
      orders: 'Orders',
      units: 'Units',
      revenue: 'Revenue',
    },
    export: 'Export CSV',
    empty: 'Nothing to report in this range.',
    totals: 'Totals',
    back: 'All reports',
  },
  live: {
    title: 'Live view',
    visitors: 'Visitors in the last 30 minutes',
    perMinute: 'Visitors per minute',
    activeCarts: 'Carts in the last hour',
    ordersLastHour: 'Orders in the last hour',
    revenueLastHour: 'Revenue in the last hour',
    events: 'Latest activity',
    eventsEmpty: 'Nothing has happened today yet.',
    orderEvent: (label: string) => `Order ${label}`,
    cartEvent: (label: string) => (label ? `Cart started by ${label}` : 'Cart started'),
    updating: 'Updates every 15 seconds',
  },
} as const

/** Ranges the picker offers, in order. */
export const RANGE_KEYS = ['today', '7d', '30d', '90d'] as const
