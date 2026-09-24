export const CUSTOMER_SEGMENTS = ['new', 'returning', 'subscribed'] as const
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]

/** Lifetime spend at or above this reads as VIP until the store can configure it. */
export const VIP_SPEND_PAISE = 2_000_000
/** Someone who ordered inside this window counts as active (status cell, frame 5:3148). */
export const ACTIVE_WINDOW_DAYS = 90

export type CustomerActivity = 'active' | 'inactive' | 'vip'

/** Where a customer stands today: VIP wins, then recent activity. */
export function customerActivity(
  customer: { spentPaise: number; lastOrderAt: Date | string | null },
  now = new Date(),
): CustomerActivity {
  if (customer.spentPaise >= VIP_SPEND_PAISE) return 'vip'
  if (!customer.lastOrderAt) return 'inactive'
  const cutoff = now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000
  return new Date(customer.lastOrderAt).getTime() >= cutoff ? 'active' : 'inactive'
}

/**
 * Short readable code for the frame's "#CUST001" column. There is no customer
 * number in the schema, so the tail of the record id stands in: stable, unique
 * and short enough to read out on a call.
 */
export function customerCode(id: string): string {
  return `#${id.replaceAll('-', '').slice(-6).toUpperCase()}`
}

/** Copy for the Customers section. */
export const customersContent = {
  title: 'Customers',
  /* Frame 5:2879: three stacked tiles beside the overview chart, then the table. */
  heading: 'Customer list',
  resource: { singular: 'customer', plural: 'customers' },
  tiles: {
    total: 'Total customers',
    newCustomers: 'New customers',
    visitors: 'Visitor',
    newThisMonth: 'New customers',
    returning: 'Returning',
    average: 'Average lifetime value',
    period: 'Last 30 days',
    week: 'Last 7 days',
    allTime: 'All time',
  },
  overview: {
    title: 'Customer overview',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    tabs: {
      activeCustomers: 'Active customers',
      repeatCustomers: 'Repeat customers',
      shopVisitors: 'Shop visitors',
      conversionRate: 'Conversion rate',
    },
    series: {
      activeCustomers: 'Active customers',
      repeatCustomers: 'Repeat customers',
      shopVisitors: 'Shop visitors',
      conversionRate: 'Conversion rate',
    },
  },
  tabs: {
    all: 'All customers',
    new: 'New',
    returning: 'Returning',
    subscribed: 'Subscribed',
  } satisfies { all: string } & Record<CustomerSegment, string>,
  columns: {
    code: 'Customer id',
    name: 'Name',
    phone: 'Phone',
    orderCount: 'Order count',
    totalSpend: 'Total spend',
    status: 'Status',
    action: 'Action',
    email: 'Email',
    location: 'Location',
    orders: 'Orders',
    spent: 'Spent',
    lastOrder: 'Last order',
    tags: 'Tags',
  },
  rowActions: {
    message: (name: string) => `Email ${name}`,
    noEmail: 'No email on file',
    delete: (name: string) => `Delete ${name}`,
    deleteHeading: 'Delete this customer?',
    deleteBody: 'The record and its notes go away. This cannot be undone.',
    deleteBlocked: (n: number) =>
      n === 1
        ? 'This customer has an order, so the record stays with the order history.'
        : `This customer has ${n} orders, so the record stays with the order history.`,
    deleted: 'Customer deleted',
    cancel: 'Cancel',
    confirm: 'Delete',
  },
  filters: {
    heading: 'Filter customers',
    state: 'State',
    anyState: 'Any state',
    minSpend: 'Spent at least',
    maxSpend: 'Spent at most',
    orders: 'Minimum orders',
    marketing: 'Marketing',
    marketingAny: 'Anyone',
    marketingYes: 'Subscribed',
    marketingNo: 'Not subscribed',
    tag: 'Tag',
    anyTag: 'Any tag',
    applied: {
      state: (code: string) => `State ${code}`,
      minSpend: (amount: string) => `Spent ${amount} or more`,
      maxSpend: (amount: string) => `Spent up to ${amount}`,
      orders: (n: number) => `${n} orders or more`,
      marketing: (yes: boolean) => (yes ? 'Subscribed' : 'Not subscribed'),
      tag: (tag: string) => `Tag ${tag}`,
    },
  },
  bulk: {
    addTag: 'Add tag',
    removeTag: 'Remove tag',
    export: 'Export selection',
    tagHeading: 'Tag customers',
    tagLabel: 'Tag name',
    tagPlaceholder: 'vip',
    apply: 'Apply',
    cancel: 'Cancel',
    tagged: (n: number) => (n === 1 ? '1 customer updated' : `${n} customers updated`),
    noChange: 'Nothing to change',
    failed: 'Could not update the tags',
  },
  saveSegment: 'Save as segment',
  exportAll: 'Export',
  exported: (n: number) => (n === 1 ? '1 row exported' : `${n} rows exported`),
  exportFailed: 'Could not build the export',
  unnamed: 'No name',
  never: 'Never',
  empty: {
    heading: 'No customers yet',
    body: 'Everyone who places an order shows up here with their order history and contact details.',
  },
  detail: {
    heading: 'Customer not found',
    body: 'This customer record does not exist in the current store.',
    action: { label: 'Back to customers', href: '/customers' },
  },
} as const

/** Copy for the customer detail page. */
export const customerDetailContent = {
  back: 'Customers',
  since: (when: string) => `Customer since ${when}`,
  badges: { returning: 'Returning', vip: 'VIP' },
  actions: {
    edit: 'Edit',
    email: 'Email customer',
    delete: 'Delete customer',
    deleteHeading: 'Delete this customer?',
    deleteBody: 'The record and its notes go away. This cannot be undone.',
    deleteBlocked: (n: number) =>
      n === 1
        ? 'This customer has an order, so the record stays with the order history.'
        : `This customer has ${n} orders, so the record stays with the order history.`,
    deleted: 'Customer deleted',
    cancel: 'Cancel',
    confirm: 'Delete',
  },
  edit: {
    heading: 'Edit customer',
    name: 'Name',
    email: 'Email',
    emailHelp: 'The email comes from the orders this customer places.',
    phone: 'Phone',
    address: 'Default address',
    line1: 'Address',
    line2: 'Apartment, landmark',
    city: 'City',
    state: 'State code',
    pincode: 'Pincode',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Customer saved',
    failed: 'Could not save the customer',
  },
  totals: {
    heading: 'Stats',
    orders: 'Orders',
    spent: 'Total spent',
    lastOrder: 'Last order',
    average: 'Average order',
    firstOrder: 'First order',
  },
  profile: {
    heading: 'Profile',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Default address',
    noAddress: 'No address on file',
    marketing: 'Accepts marketing emails and messages',
    marketingSaved: 'Marketing preference saved',
    created: 'Customer since',
    copy: (what: string) => `Copy ${what}`,
    copied: (what: string) => `${what} copied`,
    save: 'Save',
    saved: 'Customer saved',
    failed: 'Could not save the customer',
  },
  orders: {
    heading: 'Orders',
    empty: 'No orders from this customer yet. Their first purchase will show up here.',
    columns: { order: 'Order', date: 'Date', status: 'Status', total: 'Total' },
  },
  timeline: {
    heading: 'Messages sent',
    empty: 'No notifications sent to this customer yet.',
    template: {
      order_placed: 'Order confirmation',
      payment_received: 'Payment received',
      order_shipped: 'Shipping update',
      checkout_recovery: 'Checkout reminder',
      document_copy: 'Invoice copy',
    } as Record<string, string>,
    status: { queued: 'Queued', sent: 'Sent', failed: 'Failed' } as Record<string, string>,
    via: (channel: string) => `via ${channel}`,
  },
  tags: {
    heading: 'Tags',
    placeholder: 'Add a tag and press Enter',
    saved: 'Tags saved',
  },
  note: {
    heading: 'Note',
    placeholder: 'Anything the team should know about this customer',
    save: 'Save note',
    saved: 'Note saved',
  },
} as const

/** Copy for segments: the list, the builder and the rule rows. */
export const segmentsContent = {
  title: 'Segments',
  heading: 'Customer segments',
  intro: 'A segment is a saved filter. Open one to see who is in it right now.',
  resource: { singular: 'segment', plural: 'segments' },
  create: 'Create segment',
  columns: { name: 'Segment', customers: 'Customers', updated: 'Updated' },
  empty: {
    heading: 'No segments yet',
    body: 'Save a filter as a segment to reuse it for discounts and messages.',
  },
  notFound: {
    heading: 'Segment not found',
    body: 'This segment does not exist in the current store.',
    action: { label: 'Back to segments', href: '/customers/segments' },
  },
  builder: {
    newHeading: 'New segment',
    editHeading: 'Edit segment',
    back: 'Segments',
    name: 'Segment name',
    namePlaceholder: 'Repeat buyers in Maharashtra',
    conditions: 'Conditions',
    match: 'Customers must match',
    matchAll: 'all conditions',
    matchAny: 'any condition',
    add: 'Add condition',
    remove: 'Remove condition',
    empty: 'No conditions yet, so every customer matches.',
    preview: 'Matching customers',
    previewCount: (n: number) => (n === 1 ? '1 customer' : `${n} customers`),
    previewEmpty: 'Nothing matches these conditions yet.',
    save: 'Save segment',
    saved: 'Segment saved',
    failed: 'Could not save the segment',
    deleted: 'Segment deleted',
    delete: 'Delete segment',
    deleteHeading: 'Delete this segment?',
    deleteBody: 'The saved filter goes away. Customers are not affected.',
    cancel: 'Cancel',
    confirm: 'Delete',
    nameRequired: 'Give the segment a name',
    viewCustomers: 'View customers',
  },
  fields: {
    spend: 'Total spent',
    orders: 'Order count',
    state: 'State',
    tag: 'Tag',
    last_order_days: 'Days since last order',
    marketing: 'Marketing consent',
  } as Record<string, string>,
  ops: {
    gte: 'is at least',
    lte: 'is at most',
    eq: 'is',
    neq: 'is not',
    contains: 'includes',
  } as Record<string, string>,
  marketingValues: { true: 'Subscribed', false: 'Not subscribed' } as Record<string, string>,
  valuePlaceholder: {
    spend: '5000',
    orders: '2',
    state: 'MH',
    tag: 'vip',
    last_order_days: '90',
    marketing: '',
  } as Record<string, string>,
} as const
