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
    viewOrders: 'View orders',
    addTag: 'Add tag',
  },
  filters: {
    heading: 'Filter customers',
    state: 'State',
    spend: 'Spend',
    minSpend: 'Spent at least',
    maxSpend: 'Spent at most',
    orders: 'Orders',
    minOrders: 'At least',
    maxOrders: 'At most',
    created: 'Customer since',
    lastOrder: 'Last order',
    anyDate: 'Any date',
    dateOptions: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
    emailConsent: 'Email marketing',
    smsConsent: 'SMS marketing',
    whatsappConsent: 'WhatsApp marketing',
    subscribed: 'Subscribed',
    notSubscribed: 'Not subscribed',
    business: 'Business customers',
    businessYes: 'Has a GSTIN',
    businessNo: 'No GSTIN',
    tag: 'Tag',
  },
  bulk: {
    addTag: 'Add tag',
    removeTag: 'Remove tag',
    export: 'Export selection',
    email: 'Email',
    /** The bulk bar's More menu: export, email, automations and delete. */
    more: 'More actions',
    tagHeading: 'Tag customers',
    tagLabel: 'Tag name',
    tagPlaceholder: 'vip',
    apply: 'Apply',
    cancel: 'Cancel',
    tagged: (n: number) => (n === 1 ? '1 customer updated' : `${n} customers updated`),
    noChange: 'Nothing to change',
    failed: 'Could not update the tags',
    marketing: 'Marketing',
    subscribe: (channel: string) => `Subscribe to ${channel}`,
    unsubscribe: (channel: string) => `Unsubscribe from ${channel}`,
    consentTitle: (granted: boolean, channel: string, n: number) => {
      const who = n === 1 ? '1 customer' : `${n} customers`
      return granted
        ? `Subscribe ${who} to ${channel} marketing?`
        : `Unsubscribe ${who} from ${channel} marketing?`
    },
    consentBody: (granted: boolean) =>
      granted
        ? 'Only do this if they agreed to hear from you, for example on a call or a signed form. Each change is kept in their consent history.'
        : 'They stop getting marketing on this channel. Each change is kept in their consent history.',
    consentConfirm: (granted: boolean) => (granted ? 'Subscribe' : 'Unsubscribe'),
    consentFailed: 'Could not update marketing consent',
    bulkEdit: 'Bulk edit',
    openFailed: 'Could not open the bulk editor',
    delete: 'Delete',
    deleteTitle: (n: number) => (n === 1 ? 'Delete 1 customer?' : `Delete ${n} customers?`),
    deleteBody:
      'Their records and notes go away. This cannot be undone. Customers with orders stay, so the order history keeps them.',
    deleteConfirm: 'Delete',
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
    createOrder: 'Create order',
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
  /** The strip under the header (audit #82): what they are worth at a glance. */
  summary: {
    spent: 'Amount spent',
    orders: 'Orders',
    since: 'Customer since',
    lastOrder: 'Last order',
    average: (amount: string) => `${amount} average order`,
    firstOrder: (date: string) => `First order ${date}`,
    noOrders: 'No orders yet',
  },
  /** "Email customer" (audit #80): a plain email sent through the store's email channels. */
  email: {
    title: 'Email customer',
    to: 'To',
    subject: 'Subject',
    message: 'Message',
    help: 'Sent as plain text from your store’s email. It shows under Messages sent and on the timeline.',
    send: 'Send email',
    cancel: 'Cancel',
    sent: (to: string) => `Email sent to ${to}`,
    failed: 'Could not send the email',
    required: 'Add a subject and a message',
  },
  totals: {
    heading: 'Lifetime',
    orders: 'Orders',
    spent: 'Total spent',
    lastOrder: 'Last order',
    average: 'Average order',
    firstOrder: 'First order',
  },
  /** A contact phone taken from the customer's latest order or address (issue #810). */
  contactPhone: {
    missing: 'No phone number',
    add: 'Add phone',
    takeFromOrder: (phone: string) => `Use ${phone} from their latest order`,
    takeFromAddress: (phone: string) => `Use ${phone} from their saved address`,
    taken: (phone: string) => `${phone} from their order belongs to another customer.`,
    openOther: 'Open that customer',
    saved: 'Phone number saved',
    failed: 'Could not save the phone number',
    consentNeedsPhone: 'Add a phone number to ask for WhatsApp/SMS consent.',
    notSendable: 'Not set up in your store yet',
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
      customer_message: 'Email from you',
    } as Record<string, string>,
    status: { queued: 'Queued', sent: 'Sent', failed: 'Failed' } as Record<string, string>,
    via: (channel: string) => `via ${channel}`,
  },
  tags: {
    heading: 'Tags',
    placeholder: 'Add a tag and press Enter',
    remove: (tag: string) => `Remove ${tag}`,
  },
  note: {
    heading: 'Notes',
    placeholder: 'Anything the team should know',
  },
  /** GSTIN and legal name for B2B invoices; saved with the page's other edits. */
  business: {
    heading: 'Business details',
    gstin: 'GSTIN',
    gstinPlaceholder: '06AAACW1234A1Z5',
    businessName: 'Business name',
    businessNamePlaceholder: 'Registered business name',
    hint: 'Saved from checkout when the customer enters a GSTIN.',
  },
  /** Why a GSTIN was refused, by `validateGstin` reason (same rules as checkout). */
  gstinErrors: {
    shape: 'A GSTIN has 15 characters, like 06AAACW1234A1Z5',
    state: 'The first two digits are not a GST state code',
    checksum: 'This GSTIN has a typo: its last character does not match the rest',
  },
  /** One save bar for the page's inline edits: note, tags, business details and consent. */
  changes: {
    unsaved: 'Unsaved changes',
    save: 'Save',
    discard: 'Discard',
    saved: 'Customer saved',
    failed: 'Could not save. Your changes are still here.',
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
  templates: {
    heading: 'Start from a template',
    body: 'Ready-made segments most stores use. Open one, change the numbers to suit your store, and save it.',
    use: 'Use template',
    items: {
      topSpenders: {
        name: 'Top spenders',
        description: 'Spent ₹10,000 or more with you.',
      },
      repeatBuyers: { name: 'Repeat buyers', description: 'Ordered at least twice.' },
      oneTimeBuyers: {
        name: 'One-time buyers',
        description: 'Ordered once. A nudge can turn them into repeat buyers.',
      },
      recentBuyers: { name: 'Bought in the last 30 days', description: 'Fresh, happy customers.' },
      lapsed: {
        name: 'No order in 90 days',
        description: 'Customers drifting away. Win them back with an offer.',
      },
      slippingVips: {
        name: 'Big spenders slipping away',
        description: 'Spent ₹5,000 or more but have not ordered in 60 days.',
      },
      subscribed: {
        name: 'Subscribed to marketing',
        description: 'Agreed to hear from you, so you can message them.',
      },
      business: {
        name: 'Business customers',
        description: 'Customers who saved a GSTIN. Send them bulk offers or GST-ready invoices.',
      },
    },
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
    previewLive: 'counted live from your customers',
    previewAll: 'Every customer, until you add a condition',
    newIntro: 'Pick who belongs in it. The count updates as you go.',
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
    business: 'Customer type',
  } as Record<string, string>,
  ops: {
    gte: 'is at least',
    lte: 'is at most',
    eq: 'is',
    neq: 'is not',
    contains: 'includes',
  } as Record<string, string>,
  marketingValues: { true: 'Subscribed', false: 'Not subscribed' } as Record<string, string>,
  businessValues: {
    true: 'Business (has a GSTIN)',
    false: 'Individual (no GSTIN)',
  } as Record<string, string>,
  /** Joins conditions when any one of them is enough. */
  orJoin: ' or ',
  valuePlaceholder: {
    spend: '5000',
    orders: '2',
    state: 'MH',
    tag: 'vip',
    last_order_days: '90',
    marketing: '',
    business: '',
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
