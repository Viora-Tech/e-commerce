/**
 * The row lists settings pages open on (Shopify's row list + detail pattern, #147): each row's
 * title and its current value in a few words. Page titles and detail copy stay in each page's
 * own `data/<feature>.ts`.
 */
export const settingsRowsContent = {
  needsFix: 'Needs a fix',
  notSet: 'Not set',
  on: 'On',
  off: 'Off',

  taxes: {
    back: 'GST & invoices',
    gstNumbers: 'GST numbers',
    gstCount: (n: number) => (n === 0 ? 'None added' : n === 1 ? '1 number' : `${n} numbers`),
    registration: 'GST registration',
    notRegistered: 'Not registered',
    charging: 'How you charge GST',
    composition: 'Composition scheme',
    rate: (rate: number, inclusive: boolean) =>
      `${rate}% · ${inclusive ? 'prices include GST' : 'added on top'}`,
    invoices: 'Invoice numbers',
    invoiceNext: (sample: string) => `Next: ${sample}`,
    einvoice: 'E-invoicing (IRN)',
    einvoiceValue: 'Coming soon',
  },

  notifications: {
    back: 'Notifications',
    customers: 'Customer messages',
    you: 'Messages to you',
    countOn: (on: number, total: number) => `${on} of ${total} on`,
    sender: 'Sender email',
    senderNotSet: 'Not set',
    sending: 'How messages are sent',
    email: 'Email',
    whatsapp: 'WhatsApp',
    notConnected: 'Not connected',
    advanced: 'Advanced',
    advancedValue: 'Developer log and email designs',
  },

  policies: {
    back: 'Policies',
    list: 'Your policies',
    published: (n: number, total: number) => `${n} of ${total} published`,
    business: 'Business name on policies',
    grievance: 'Grievance officer',
  },

  returns: {
    back: 'Returns',
    requests: 'Online return requests',
    window: (days: number) => `On · ${days} days after delivery`,
    reasons: 'Return reasons',
    reasonsValue: (n: number, total: number) => `${n} of ${total}`,
    rules: 'Exchanges and auto-approval',
    exchanges: 'Exchanges',
    autoApprove: 'Auto-approval',
    refund: 'Refund suggestion',
    original: 'How they paid',
    storeCredit: 'Store credit',
  },

  privacy: {
    back: 'Privacy & data requests',
    banner: 'Cookie banner',
    bannerValue: (version: number, total: number) =>
      `Version ${version} · ${total} answers in 30 days`,
    requests: 'Data requests',
    requestsValue: (open: number, overdue: number) =>
      open === 0 ? 'None open' : overdue > 0 ? `${open} open, ${overdue} late` : `${open} open`,
    grievance: 'Grievance officer',
    accounts: 'Customer accounts',
    accountsValue: 'Deleting an account',
  },

  staff: {
    members: 'Members',
    membersValue: (n: number) => (n === 1 ? '1 person' : `${n} people`),
    invites: 'Pending invites',
    invitesValue: (n: number) => (n === 0 ? 'None' : `${n} waiting`),
    roles: 'Roles',
    rolesValue: (n: number) => (n === 1 ? '1 role' : `${n} roles`),
  },

  ai: {
    usage: 'This month’s use',
    features: 'AI features',
    featuresValue: (on: number, total: number, quality: string) =>
      `${on} of ${total} on · ${quality}`,
    privacy: 'What AI sees',
    privacyValue: 'Your data stays yours',
    activity: 'AI activity',
    activityValue: 'Every change, with Undo',
  },

  costs: {
    ratesSet: (n: number, total: number) => `${n} of ${total} set`,
    noGateways: 'No gateways yet',
  },

  mcp: {
    connect: 'Connect an app',
    connectValue: 'Address and steps',
    apps: 'Connected apps',
    appsValue: (n: number) => (n === 0 ? 'None yet' : `${n} connected`),
    permissions: 'Permissions',
    permissionsValue: (changes: boolean, customers: boolean) =>
      `${changes ? 'Can make changes' : 'Read only'}${customers ? ' · sees customers' : ''}`,
    tokens: 'API tokens',
    tokensValue: (n: number) => (n === 0 ? 'None' : n === 1 ? '1 active' : `${n} active`),
    activity: 'Activity',
    activityValue: 'Every request an app made',
  },

  billing: {
    autopayOn: 'UPI AutoPay on',
    payByLink: 'Pay by link',
    count: (n: number) => (n === 0 ? 'None yet' : String(n)),
    downgradeTo: (plan: string) => `Move to ${plan}`,
  },

  shipping: {
    back: 'Shipping & delivery',
    rates: 'Shipping rates',
    ratesValue: 'Zones, profiles and rates',
    packages: 'Packages',
    packagesValue: (n: number) =>
      n === 0 ? 'None saved' : n === 1 ? '1 package' : `${n} packages`,
    dispatch: 'Dispatch',
    dispatchValue: (pincode: string, cutoff: string) => `From ${pincode} · orders by ${cutoff}`,
    /** No PIN code saved yet: the 110001 the page would show is only a placeholder (#66). */
    dispatchNotSet: 'PIN code to ship from not set',
    split: 'Split shipping',
    splitValue: (n: number) => (n === 1 ? 'Never split' : `Up to ${n} parcels`),
    courier: 'Which courier ships',
    cheapest: 'Cheapest',
    noCourier: 'No courier yet',
    preferred: (courier: string) => `Always ${courier}`,
    perZone: 'By region',
    pincode: 'Check a PIN code',
    pincodeValue: 'Delivery dates and couriers',
    demo: 'Demo courier',
  },

  approvals: {
    waitingValue: (n: number) => (n === 0 ? 'Nothing waiting' : `${n} waiting`),
    mineValue: (n: number) => (n === 0 ? 'None in 30 days' : `${n} in 30 days`),
  },
} as const
