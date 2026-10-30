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
    senderValue: 'Who your emails come from',
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
} as const
