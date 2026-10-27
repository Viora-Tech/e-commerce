import type {
  ConsentChannel,
  DataRequestKind,
  DataRequestSource,
  DataRequestStatus,
  RequestUrgency,
} from '@commerce/core/privacy'

/** Settings → Privacy & data requests, the data request queue and the customer consent card. */
export const customerPrivacyContent = {
  title: 'Privacy & data requests',
  subtitle:
    "What India's data protection law (DPDP Act 2023) asks of your store: a cookie choice, answering data requests on time, and messaging only people who said yes.",
  save: 'Save',
  saved: 'Privacy settings saved',
  failed: 'Could not save. Try again.',
  loadFailed: 'Could not load customer privacy settings.',
  banner: {
    heading: 'Cookie banner',
    body: 'Shoppers choose whether to allow analytics and marketing cookies. Nothing optional runs until they say yes, including your store analytics, Google tags and the Meta pixel.',
    message: 'Banner message',
    messageHelp: 'Leave empty to use the standard message.',
    messagePlaceholder:
      'We use cookies to run the store. With your permission we also use them to understand visits and show you relevant offers.',
    version: (v: number) => `Banner version ${v}`,
    askAgain: 'Ask everyone again',
    askAgainHelp:
      'Use this after adding a new tag or changing what the banner says. Everyone sees the banner again, and optional tags wait for a new answer.',
    askAgainConfirmTitle: 'Show the banner to everyone again?',
    askAgainConfirmBody:
      'Every shopper is asked again on their next visit. Until they answer, analytics and marketing tags stay off for them.',
    askAgainConfirm: 'Ask everyone again',
    askedAgain: 'Everyone will see the banner again',
    stats: (total: number, analytics: number, marketing: number) =>
      total === 0
        ? 'No answers in the last 30 days yet.'
        : `Last 30 days: ${total} answers. ${analytics} allowed analytics, ${marketing} allowed marketing.`,
  },
  requests: {
    heading: 'Data requests',
    body: 'Customers can ask for a copy of their data or for it to be deleted, from their account page or by writing to you.',
    dueDays: 'Days to answer a request',
    dueDaysHelp:
      'Each request gets a due date this many days after it arrives. 30 days is a safe default.',
    days: 'days',
    counts: (open: number, overdue: number) =>
      open === 0
        ? 'No open requests.'
        : overdue > 0
          ? `${open} open, ${overdue} past the due date.`
          : `${open} open, all on time.`,
    view: 'View requests',
  },
  grievance: {
    heading: 'Grievance officer',
    body: 'The person customers can contact about their personal data. Shown in your privacy policy and your store footer.',
    missing: 'Not set yet. Customers need someone to contact.',
    edit: 'Edit in Policies',
  },
  accounts: {
    heading: 'Customer accounts',
    body: 'Customers delete their own account from their account page after confirming with a code. Choose how they sign in in Customer accounts.',
    link: 'Open Customer accounts',
  },
} as const

export const KIND_LABEL: Record<DataRequestKind, string> = {
  export: 'Copy of data',
  delete: 'Delete data',
}

export const STATUS_LABEL: Record<DataRequestStatus, string> = {
  open: 'New',
  in_progress: 'In progress',
  completed: 'Done',
  rejected: 'Declined',
}

export const SOURCE_LABEL: Record<DataRequestSource, string> = {
  account: 'Account page',
  email: 'Email',
  phone: 'Phone call',
  other: 'Other',
}

export const URGENCY_LABEL: Record<RequestUrgency, (days: number) => string> = {
  overdue: (days) => `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} late`,
  due_soon: (days) => (days <= 0 ? 'Due today' : `Due in ${days} ${days === 1 ? 'day' : 'days'}`),
  on_track: (days) => `Due in ${days} days`,
  closed: () => '',
}

export const CHANNEL_LABEL: Record<ConsentChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
}

export const dataRequestsContent = {
  title: 'Data requests',
  subtitle: 'Copies of data and deletions customers asked for. Answer each before its due date.',
  back: 'Privacy & data requests',
  tabs: { open: 'Open', closed: 'Closed', all: 'All' },
  empty: {
    open: 'No open requests. When a customer asks, it shows up here.',
    closed: 'No closed requests yet.',
    all: 'No requests yet.',
  },
  columns: {
    request: 'Request',
    customer: 'Customer',
    kind: 'Asked for',
    status: 'Status',
    due: 'Due',
  },
  number: (n: number) => `#${n}`,
  unknownCustomer: 'Not matched to a customer',
  erasedCustomer: 'Erased customer',
  log: 'Log a request',
  loadFailed: 'Could not load requests.',
} as const

export const logRequestContent = {
  title: 'Log a request',
  body: 'Use this when a customer asks by email, phone or in person.',
  kind: 'What do they want?',
  kinds: {
    export: { label: 'A copy of their data', hint: 'You send them a file with what you hold.' },
    delete: {
      label: 'Delete their data',
      hint: 'Their personal data is erased. Order records the law needs are kept.',
    },
  },
  source: 'How did they ask?',
  customer: 'Customer',
  customerHelp: 'Search by name, email or phone. Leave empty if they are not a customer.',
  customerPlaceholder: 'Search customers',
  noMatch: 'No customer matches. You can still log the request.',
  clear: 'Clear',
  contactEmail: 'Their email',
  contactPhone: 'Their phone',
  note: 'Note',
  notePlaceholder: 'What they said, and anything that helps you answer',
  cancel: 'Cancel',
  submit: 'Log request',
  logged: (n: number) => `Request #${n} logged`,
  failed: 'Could not log the request.',
} as const

export const dataRequestDetailContent = {
  back: 'Data requests',
  title: (n: number) => `Request #${n}`,
  loadFailed: 'Could not load this request.',
  details: 'Details',
  kind: 'Asked for',
  source: 'Came from',
  received: 'Received',
  due: 'Answer by',
  contact: 'Contact',
  note: 'Note',
  resolution: 'Outcome',
  customer: 'Customer',
  noCustomer:
    'This request is not matched to a customer. Find the customer and link them, or decline if they have no data with you.',
  openCustomer: 'Open customer',
  erased: 'This customer’s personal data was erased.',
  steps: {
    heading: 'What to do',
    export:
      'Download the file, check it, and send it to the customer from your own email. Then mark the request done.',
    delete:
      'Erase the customer’s data. Orders and invoices keep what tax law needs (name, address, GSTIN, amounts); everything else is removed. This cannot be undone.',
  },
  start: 'Mark in progress',
  exportJson: 'Download JSON',
  exportCsv: 'Download spreadsheet (CSV)',
  exported: 'Download ready',
  erase: 'Erase customer data',
  eraseTitle: 'Erase this customer’s personal data?',
  eraseBody:
    'Name, email, phone, saved addresses and notes are removed and they are signed out everywhere. Orders and GST invoices keep the buyer name, address and GSTIN for as long as the law requires. This cannot be undone.',
  eraseConfirm: 'Erase data',
  erasedToast: 'Customer data erased and the request is done',
  complete: 'Mark done',
  decline: 'Decline',
  declineTitle: 'Decline this request?',
  declineBody: 'Say why, in words you could send the customer.',
  declineReason: 'Reason',
  declineConfirm: 'Decline request',
  cancel: 'Cancel',
  updated: 'Request updated',
  failed: 'Could not update the request.',
  trail: 'History',
} as const

/** One line per audit entry, in plain words. */
export const auditContent = {
  empty: 'Nothing recorded yet.',
  customer: 'The customer',
  system: 'The store',
  actions: {
    'request.created': 'logged the request',
    'request.status': 'changed the status',
    'request.note': 'linked a customer',
    'export.downloaded': 'downloaded a copy of the data',
    'customer.anonymised': 'erased the customer’s personal data',
    'consent.changed': 'changed marketing consent',
    'settings.saved': 'saved privacy settings',
    'account.deletion_requested': 'confirmed deleting their account with a code',
    'contact.phone_added': 'saved the phone from their order as their contact number',
  } as Record<string, string>,
  status: (from: string, to: string) => `${from} to ${to}`,
  format: (format: string) => format.toUpperCase(),
  kept: (orders: number) => `${orders} ${orders === 1 ? 'order' : 'orders'} kept for tax records`,
} as const

export const consentCardContent = {
  heading: 'Marketing consent',
  body: 'Campaigns and automations only reach this customer on channels switched on here.',
  record:
    'Only switch a channel on when the customer told you yes. We keep a record of every change.',
  saved: (channel: string, on: boolean) => `${channel} marketing ${on ? 'on' : 'off'}`,
  failed: 'Could not change consent.',
  unsubscribed: 'Unsubscribed from all marketing using the link in an email.',
  history: 'Recent changes',
  noHistory: 'No changes recorded yet.',
  granted: 'Allowed',
  withdrawn: 'Withdrawn',
  notAllowed: 'Not allowed',
  sources: {
    account: 'in their account',
    newsletter: 'newsletter signup',
    checkout: 'at checkout',
    unsubscribe_link: 'unsubscribe link',
    unsubscribe_page: 'unsubscribe page',
    admin: 'by staff',
    import: 'imported',
    erasure: 'erasure',
  } as Record<string, string>,
  privacy: 'Privacy',
  exportJson: 'Download their data',
  logRequest: 'Log a data request',
} as const
