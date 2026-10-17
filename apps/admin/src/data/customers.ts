import { routes } from '@/lib/routes'

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

/** Copy for the Customers section. */
export const customersContent = {
  title: 'Customers',
  heading: 'Customers',
  /* The plain-language line under the title. */
  summary: {
    empty: 'Everyone who orders from your store shows up here.',
    total: (n: number) => (n === 1 ? '1 customer' : `${n} customers`),
    newThisWeek: (n: number) => `${n} new this week`,
    repeat: (n: number) =>
      n === 1 ? '1 has ordered more than once' : `${n} have ordered more than once`,
  },
  stats: {
    total: 'Total customers',
    newCustomers: 'New customers',
    repeat: 'Repeat customers',
    subscribed: 'Subscribed',
    vsLastWeek: 'vs last week',
    shareOfAll: (percent: number) => `${percent}% of all customers`,
    canGetEmails: 'can get your emails',
  },
  segmentsLink: 'Segments',
  loadFailed: {
    heading: 'Could not load customers',
    body: 'Check your connection and try again.',
  },
  resource: { singular: 'customer', plural: 'customers' },
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
    customer: 'Customer',
    totalSpent: 'Total spent',
    email: 'Email',
    location: 'Location',
    orders: 'Orders',
    spent: 'Spent',
    lastOrder: 'Last order',
    tags: 'Tags',
  },
  rowActions: {
    menu: (name: string) => `More actions for ${name}`,
    email: 'Email',
    whatsapp: 'WhatsApp',
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
    spend: 'Spend',
    minSpend: 'Spent at least',
    maxSpend: 'Spent at most',
    orders: 'Minimum orders',
    marketing: 'Marketing',
    marketingAny: 'Anyone',
    marketingYes: 'Subscribed',
    marketingNo: 'Not subscribed',
    tag: 'Tag',
    anyTag: 'Any tag',
  },
  bulk: {
    addTag: 'Add tag',
    removeTag: 'Remove tag',
    export: 'Export selection',
    email: 'Email',
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
  statuses: { vip: 'VIP', active: 'Active', inactive: 'Inactive' },
  exported: (n: number) => (n === 1 ? '1 row exported' : `${n} rows exported`),
  exportFailed: 'Could not build the export',
  unnamed: 'No name',
  never: 'Never',
  empty: {
    heading: 'No customers yet',
    body: 'Everyone who places an order shows up here with their order history and contact details.',
  },
  noResults: {
    heading: 'No customers match these filters',
    body: 'Try a different search or clear the filters.',
  },
  detail: {
    heading: 'Customer not found',
    body: 'This customer record does not exist in the current store.',
    action: { label: 'Back to customers', href: routes.customers.list() },
  },
} as const

/** Copy for the customer detail page. */
export const customerDetailContent = {
  back: 'Customers',
  since: (when: string) => `Customer since ${when}`,
  sinceToday: 'Customer since today',
  sinceYesterday: 'Customer since yesterday',
  withCity: (text: string, city: string) => `${text} · ${city}`,
  badges: { returning: 'Returning', vip: 'VIP', new: 'New' },
  nextStep: {
    eyebrow: 'Next step',
    notNow: 'Not now',
    vip: {
      title: 'Thank your VIP',
      body: (orders: number, spent: string) =>
        `${orders === 1 ? '1 order' : `${orders} orders`} and ${spent} spent. Tell them about your next drop before anyone else.`,
    },
    winBack: {
      title: 'Win them back',
      body: (days: number) =>
        `No order in ${days} days. A friendly message often brings people back.`,
    },
    whatsapp: 'Message on WhatsApp',
    email: 'Email instead',
    emailPrimary: 'Send an email',
  },
  actions: {
    edit: 'Edit',
    more: 'More actions',
    whatsapp: 'WhatsApp',
    call: 'Call',
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
    heading: 'Lifetime',
    orders: 'Orders',
    spent: 'Total spent',
    lastOrder: 'Last order',
    average: 'Average order',
    firstOrder: 'First order',
  },
  profile: {
    heading: 'Contact',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Default address',
    noAddress: 'No address on file',
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
    emptyHeading: 'No orders yet',
    emptyBody: 'Once this customer orders, you will see it here.',
    createOrder: 'Create an order',
    viewAll: 'View all orders',
    showing: (shown: number, total: number) =>
      shown < total ? `Showing the ${shown} most recent orders` : `Showing all ${total} orders`,
    columns: { order: 'Order', date: 'Date', status: 'Status', total: 'Total' },
  },
  activity: {
    heading: 'Timeline',
    empty: 'Nothing has happened yet. Orders and messages will show up here.',
    placed: (number: number, total: string) => `Placed order #${number} for ${total}`,
    sent: (what: string, channel: string) => `${what} sent by ${channel}`,
    failed: (what: string) => `${what} could not be sent`,
    more: (n: number) => `Show ${n} older`,
    less: 'Show fewer',
  },
  timeline: {
    heading: 'Messages sent',
    empty: 'No messages sent to this customer yet.',
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
    remove: (tag: string) => `Remove ${tag}`,
  },
  note: {
    heading: 'Notes',
    placeholder: 'Anything the team should know',
    save: 'Save note',
    saved: 'Note saved',
    unsaved: 'Unsaved changes',
    discard: 'Discard',
    failed: 'Could not save the note',
  },
} as const

/** Copy for segments: the list, the builder and the rule rows. */
export const segmentsContent = {
  title: 'Segments',
  heading: 'Customer segments',
  intro: 'A segment is a saved filter. Open one to see who is in it right now.',
  summary: (n: number) =>
    n === 0
      ? 'No segments yet'
      : n === 1
        ? '1 saved filter, counted live'
        : `${n} saved filters, counted live`,
  back: 'Customers',
  resource: { singular: 'segment', plural: 'segments' },
  create: 'Create segment',
  columns: { name: 'Segment', customers: 'Customers', updated: 'Updated' },
  empty: {
    heading: 'Group customers who behave alike',
    body: 'Make a segment like "bought twice in 60 days" and send it a WhatsApp campaign or a discount.',
  },
  notFound: {
    heading: 'Segment not found',
    body: 'This segment does not exist in the current store.',
    action: { label: 'Back to segments', href: routes.customers.segments() },
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
    deleteFailed: 'Could not delete the segment',
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

/** The address form shared by the order page's edit dialog and the customer's address book. */
export const addressFormContent = {
  line1: 'Address line 1',
  line1Placeholder: 'House number, building, street',
  line2: 'Address line 2 (optional)',
  line2Placeholder: 'Area, landmark',
  pincode: 'PIN code',
  city: 'City',
  state: 'State',
  statePlaceholder: 'Choose a state',
  finding: 'Finding city and state…',
  found: (city: string, state: string) => `Filled in ${city}, ${state}. Change them if needed.`,
}

/** The address book card on the customer page. */
export const customerAddressesContent = {
  heading: 'Addresses',
  add: 'Add address',
  edit: 'Edit',
  remove: 'Delete',
  default: 'Default',
  makeDefault: 'Make this the default address',
  fromOrder: 'From their latest order',
  empty: 'No saved addresses yet.',
  dialog: {
    addTitle: 'Add address',
    editTitle: 'Edit address',
    name: 'Name',
    phone: 'Mobile number',
    save: 'Save address',
    cancel: 'Cancel',
    saved: 'Address saved',
    failed: 'Could not save the address',
  },
  confirm: {
    title: 'Delete this address?',
    body: "It is removed from the customer's address book. Past orders keep the address they were shipped to.",
    cancel: 'Keep it',
    confirm: 'Delete',
    done: 'Address deleted',
    failed: 'Could not delete the address',
  },
}
