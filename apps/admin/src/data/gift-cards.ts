/** Every string the gift card pages show. No em or en dashes. */

export const GIFT_CARD_STATES = ['active', 'disabled', 'expired', 'empty'] as const
export type GiftCardStateFilter = (typeof GIFT_CARD_STATES)[number]

/** Values offered as one-tap presets when issuing a card, in rupees. */
export const GIFT_CARD_PRESETS = [500, 1000, 2500, 5000] as const
/** Denominations a new gift card product starts with, in rupees. */
export const GIFT_CARD_PRODUCT_DEFAULTS = [500, 1000, 2000, 5000] as const
/** Expiry choices for sold cards; RBI asks for at least a year. */
export const GIFT_CARD_EXPIRY_MONTHS = [12, 24, 36, 60] as const

export const giftCardsContent = {
  heading: 'Gift cards',
  summary: 'Cards shoppers buy or you issue by hand',
  resource: { singular: 'gift card', plural: 'gift cards' },
  create: 'Create gift card',
  addProduct: 'Add gift card product',
  tiles: {
    active: 'Active gift cards',
    outstanding: 'Outstanding balance',
    products: 'Gift card products',
    now: 'Right now',
    liability: 'Owed to customers',
    onSale: (n: number) => (n === 1 ? '1 on sale' : `${n} on sale`),
  },
  tabs: {
    all: 'All',
    active: 'Active',
    disabled: 'Disabled',
    expired: 'Expired',
    empty: 'Used up',
  },
  state: {
    active: 'Active',
    disabled: 'Disabled',
    expired: 'Expired',
    empty: 'Used up',
  },
  columns: {
    code: 'Code',
    customer: 'Customer',
    source: 'Source',
    issued: 'Date issued',
    expires: 'Expires',
    balance: 'Balance',
    status: 'Status',
  },
  source: {
    manual: 'Issued manually',
    purchase: (n: number | null) => (n ? `Order #${n}` : 'Purchased'),
  },
  filters: {
    source: 'Source',
    sourceOptions: { manual: 'Issued manually', purchase: 'Bought at checkout' },
    balance: 'Balance',
    minBalance: 'Min balance',
    maxBalance: 'Max balance',
    issued: 'Date issued',
    issuedOptions: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
    expires: 'Expires',
    anyDate: 'Any date',
  },
  noCustomer: 'No customer',
  never: 'Never',
  balanceOf: (balance: string, initial: string) => `${balance} of ${initial}`,
  empty: {
    heading: 'No gift cards match',
    body: 'Try another search or status.',
  },
  start: {
    heading: 'Start selling gift cards',
    body: 'Add a gift card product shoppers can buy for someone, or issue a card by hand for a refund, a giveaway or a customer who deserves a thank you. Shoppers spend them at checkout alongside UPI, cards and Razorpay.',
  },
  voucherNote:
    'Gift card sales are vouchers: they stay out of GST invoices, and tax is charged on the order that spends the card.',
} as const

export const giftCardProductsContent = {
  heading: 'Gift card products',
  help: 'Shoppers buy these on your store and the code is emailed to them once the payment clears.',
  empty: 'No gift card product yet.',
  add: 'Add product',
  status: { active: 'Active', draft: 'Draft', archived: 'Archived' },
  dialog: {
    title: 'Add gift card product',
    body: 'One variant per denomination. It starts as a draft so you can add an image before it goes on sale.',
    name: 'Title',
    namePlaceholder: 'Gift card',
    defaultName: 'Gift card',
    denominations: 'Denominations',
    denominationsHelp: 'Press Enter to add a value.',
    add: 'Add',
    cancel: 'Cancel',
    create: 'Create product',
    creating: 'Creating…',
    created: 'Gift card product created',
    failed: 'Could not create the product',
    remove: (label: string) => `Remove ${label}`,
  },
} as const

export const giftCardSettingsContent = {
  heading: 'Expiration',
  help: 'Applies to gift cards sold on your store. Cards you issue by hand take the date you pick.',
  label: 'Sold gift cards',
  never: 'Never expire',
  months: (n: number) =>
    n % 12 === 0
      ? `Expire after ${n / 12} ${n === 12 ? 'year' : 'years'}`
      : `Expire after ${n} months`,
  saved: 'Expiration saved',
  failed: 'Could not save the expiration',
} as const

export const giftCardIssueContent = {
  heading: 'Create gift card',
  breadcrumb: 'Gift cards',
  details: 'Gift card details',
  code: 'Gift card code',
  codeHelp:
    'Leave blank or tap Generate for a random 12 character code. Custom codes are 8 to 20 letters and digits.',
  codePlaceholder: 'Generated automatically',
  codeGenerate: 'Generate',
  value: 'Initial value',
  valueInvalid: 'Enter a value above ₹0',
  expiry: 'Expiration date',
  noExpiry: 'No expiration date',
  setExpiry: 'Set expiration date',
  customer: 'Customer',
  // Fits the field without being cut off (audit #71).
  customerSearch: 'Search customers',
  customerSearching: 'Searching…',
  customerNone: 'No customers match',
  customerFailed: 'Could not load customers',
  customerHelp: 'The card shows on the customer and can be emailed to them.',
  clear: 'Remove',
  recipient: 'Or send to an email address',
  recipientName: 'Recipient name',
  message: 'Message',
  messagePlaceholder: 'Printed in the email',
  send: 'Email the gift card code now',
  sendHelp: 'Sent through the email channel in Settings, Notifications.',
  note: 'Internal note',
  notePlaceholder: 'Only staff see this',
  cancel: 'Cancel',
  save: 'Create gift card',
  saving: 'Creating…',
  failed: 'Could not create the gift card',
  reveal: {
    title: 'Gift card created',
    body: 'Copy the code now. For security it is never shown again; after this you will only see the last four characters.',
    copy: 'Copy code',
    copied: 'Code copied',
    sent: (to: string) => `Emailed to ${to}.`,
    notSent: (why: string) => `Not emailed: ${why}`,
    done: 'View gift card',
  },
} as const

export const giftCardDetailContent = {
  breadcrumb: 'Gift cards',
  title: (last: string) => `Gift card ending ${last}`,
  disable: 'Disable',
  enable: 'Enable',
  disabled: 'Gift card disabled',
  enabled: 'Gift card enabled',
  resend: 'Resend',
  resent: (to: string) => `Gift card emailed to ${to}`,
  resendFailed: 'Could not send the gift card',
  balance: {
    heading: 'Balance',
    of: (initial: string) => `of ${initial} issued`,
    adjust: 'Adjust balance',
  },
  adjust: {
    title: 'Adjust balance',
    body: 'Add or remove money from the card. Every change is kept in the history with your note.',
    add: 'Add',
    remove: 'Remove',
    amount: 'Amount',
    note: 'Reason',
    notePlaceholder: 'For example: goodwill after a late delivery',
    newBalance: (amount: string) => `New balance ${amount}`,
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Balance updated',
    failed: 'Could not update the balance',
  },
  history: {
    heading: 'History',
    columns: { date: 'Date', activity: 'Activity', amount: 'Amount', balance: 'Balance' },
    kind: {
      issue: 'Issued',
      debit: 'Used at checkout',
      refund: 'Refunded to card',
      adjustment: 'Balance adjusted',
    },
    order: (n: number) => `Order #${n}`,
    by: (who: string) => `by ${who}`,
  },
  customer: {
    heading: 'Customer',
    none: 'No customer. The card can still be spent by anyone with the code.',
    recipient: 'Recipient',
    view: 'View customer',
  },
  expiry: {
    heading: 'Expiration date',
    never: 'Never expires',
    on: (date: string) => `Expires on ${date}`,
    edit: 'Edit',
    remove: 'Remove expiration',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Expiration date saved',
  },
  /** How many checkouts may spend the card (#993). */
  usage: {
    heading: 'Usage limit',
    none: 'No limit',
    used: (n: number, limit: number | null) =>
      limit === null ? `Used ${n} ${n === 1 ? 'time' : 'times'}` : `Used ${n} of ${limit} times`,
    label: 'Times it can be used',
    help: 'Each checkout that spends the card counts once.',
    edit: 'Edit',
    remove: 'Remove limit',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Usage limit saved',
  },
  note: {
    heading: 'Notes',
    placeholder: 'Only staff see this',
    empty: 'No notes',
    save: 'Save',
    discard: 'Discard',
    unsaved: 'Unsaved changes',
    saved: 'Note saved',
  },
  details: {
    heading: 'Details',
    issued: 'Issued',
    by: 'Issued by',
    source: 'Source',
    delivered: 'Emailed',
    notDelivered: 'Not emailed yet',
    message: 'Message',
  },
  failed: 'Could not save the change',
} as const

/** The gift card list's ⋯ menu and selection bar: resend, disable and enable. */
export const giftCardListActionsContent = {
  open: 'View gift card',
  resend: 'Resend',
  disable: 'Disable',
  enable: 'Enable',
  resent: (to: string) => `Gift card emailed to ${to}`,
  resendFailed: 'Could not send the gift card',
  disabled: 'Gift card disabled',
  enabled: 'Gift card enabled',
  failed: 'Could not update the gift card',
  confirmDisable: {
    title: (n: number) => (n === 1 ? 'Disable this gift card?' : `Disable ${n} gift cards?`),
    body: 'A disabled card cannot be used at checkout. You can enable it again at any time.',
    confirm: 'Disable',
    cancel: 'Keep active',
  },
  confirmResend: {
    title: (n: number) => `Email ${n} gift card${n === 1 ? '' : 's'} again?`,
    body: 'Each code goes again to its recipient, or to the customer when there is none. Cards without an email address are skipped.',
    confirm: 'Send',
    cancel: 'Cancel',
  },
} as const
