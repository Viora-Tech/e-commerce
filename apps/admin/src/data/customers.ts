export const CUSTOMER_SEGMENTS = ['new', 'returning'] as const
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]

/** Copy for the Customers section. */
export const customersContent = {
  title: 'Customers',
  /* Same shape as the order list (frame 5:2353): heading, four tiles, tab group, table. */
  heading: 'Customer list',
  resource: { singular: 'customer', plural: 'customers' },
  tiles: {
    total: 'Total customers',
    newThisWeek: 'New customers',
    returning: 'Returning',
    marketing: 'Accept marketing',
    period: 'Last 7 days',
    allTime: 'All time',
  },
  tabs: {
    all: 'All customers',
    new: 'New',
    returning: 'Returning',
  } satisfies { all: string } & Record<CustomerSegment, string>,
  columns: {
    name: 'Customer',
    email: 'Email',
    phone: 'Phone',
    orders: 'Orders',
    spent: 'Spent',
    lastOrder: 'Last order',
    tags: 'Tags',
  },
  unnamed: 'No name',
  never: 'Never',
  empty: {
    heading: 'No customers yet',
    body: 'Everyone who places an order shows up here with their order history and contact details.',
  },
  segments: {
    heading: 'No segments',
    body: 'Segments are saved customer filters, such as repeat buyers, big spenders or one city, for targeted discounts and messages.',
    action: { label: 'View customers', href: '/customers' },
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
  totals: {
    orders: 'Orders',
    spent: 'Total spent',
    lastOrder: 'Last order',
    average: 'Average order',
  },
  profile: {
    heading: 'Profile',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Default address',
    noAddress: 'No address on file',
    marketing: 'Accepts marketing emails and messages',
    save: 'Save',
    saved: 'Customer saved',
    failed: 'Could not save the customer',
  },
  orders: {
    heading: 'Orders',
    empty: 'No orders yet',
    columns: { order: 'Order', date: 'Date', status: 'Status', total: 'Total' },
  },
  timeline: {
    heading: 'Messages sent',
    empty: 'Nothing sent to this customer yet',
    template: {
      order_placed: 'Order confirmation',
      payment_received: 'Payment received',
      order_shipped: 'Shipping update',
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
