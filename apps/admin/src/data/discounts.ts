import { routes } from '@/lib/routes'

export const DISCOUNT_LIFECYCLES = ['active', 'scheduled', 'expired', 'disabled'] as const
export type DiscountLifecycle = (typeof DISCOUNT_LIFECYCLES)[number]

/** Copy for the Discounts section. Same list shape as orders (frame 5:2353). */
export const discountsContent = {
  title: 'Discounts',
  heading: 'Discount list',
  resource: { singular: 'discount', plural: 'discounts' },
  create: 'Create discount',
  summary: (active: number, scheduled: number, used: number) =>
    `${active} active · ${scheduled} starting soon · ${used} orders used a discount in the last 30 days`,
  tiles: {
    active: 'Active discounts',
    scheduled: 'Scheduled',
    expired: 'Expired',
    usedThisMonth: 'Orders with a discount (30 days)',
    now: 'Right now',
    month: 'Last 30 days',
  },
  row: { edit: 'Edit discount' },
  tabs: {
    all: 'All discounts',
    active: 'Active',
    scheduled: 'Scheduled',
    expired: 'Expired',
    disabled: 'Disabled',
  } satisfies { all: string } & Record<DiscountLifecycle, string>,
  columns: {
    title: 'Discount',
    method: 'Value',
    kind: 'Type',
    status: 'Status',
    used: 'Used',
    dates: 'Active dates',
  },
  kind: { code: 'Code', automatic: 'Automatic' },
  lifecycle: {
    active: 'Active',
    scheduled: 'Scheduled',
    expired: 'Expired',
    disabled: 'Disabled',
  } satisfies Record<DiscountLifecycle, string>,
  usedOf: (used: number, limit: number | null) =>
    limit === null ? `${used}` : `${used} / ${limit}`,
  since: (from: string) => `Since ${from}`,
  until: (to: string) => `Until ${to}`,
  ongoing: 'Ongoing',
  noEnd: 'No end date',
  always: 'Always',
  empty: {
    heading: 'No discounts yet',
    body: 'Discount codes and automatic offers: a percentage off, a fixed amount or free shipping, applied at checkout.',
  },
  index: {
    heading: 'No discounts',
    body: 'Discount codes and automatic offers: a percentage off, a fixed amount or free shipping, applied at checkout.',
    action: { label: 'Create discount', href: routes.discounts.new() },
  },
  detail: {
    heading: 'Discount not found',
    body: 'This discount does not exist in the current store.',
    action: { label: 'Back to discounts', href: routes.discounts.list() },
  },
} as const

/** Copy for the create and edit form. */
export const discountFormContent = {
  newTitle: 'Create discount',
  newSummary: 'Set it up, then save to start offering it.',
  usedTimes: (n: number) => (n === 1 ? 'used once' : `used ${n} times`),
  saveBar: { message: 'Unsaved changes', save: 'Save', discard: 'Discard' },
  toasts: {
    saved: 'Discount saved',
    created: 'Discount created',
    deleted: 'Discount deleted',
    disabled: 'Discount disabled: it has been used on orders, so it was kept for history',
    failed: 'Save failed',
  },
  errors: {
    title: 'Give the discount a title',
    code: 'Enter a code with letters, numbers and hyphens',
    value: 'Enter a value',
    percent: 'Percent must be between 0.01 and 100',
    dates: 'End must be after start',
    products: 'Pick at least one product',
    productValues: 'Enter an amount above zero for every product',
    productPercents: 'Enter a percentage between 0.01 and 100 for every product',
  },
  method: {
    heading: 'Type',
    kindLabel: 'How shoppers get it',
    kinds: {
      code: { label: 'Discount code', help: 'Shoppers type a code at checkout.' },
      automatic: { label: 'Automatic', help: 'Applied to every eligible cart, no code needed.' },
    },
    methodLabel: 'What it gives',
    methods: {
      percent: { label: 'Percentage off', help: 'A share of the eligible items.' },
      fixed: { label: 'Fixed amount off', help: 'A rupee amount off the eligible items.' },
      free_shipping: { label: 'Free shipping', help: 'Shipping is waived on the order.' },
    },
    title: 'Title',
    titleHelp: 'Shown to shoppers in the cart and on the order.',
    code: 'Code',
    codeHelp: 'Case does not matter. Shoppers see it upper-cased.',
    generate: 'Generate',
  },
  value: {
    heading: 'Value',
    percent: 'Percentage',
    amount: 'Amount',
    appliesTo: 'Applies to',
    all: 'Entire order',
    products: 'Specific products',
    productsHelp: 'Pick the products this discount covers.',
    productSearch: 'Search products',
    noProducts: 'No products match',
    perProduct: 'Different amount for each product',
    perProductHelp:
      'Type an amount next to each product. It comes off every piece, so 2 of a product get it twice.',
    amountFor: (title: string) => `Amount off ${title}`,
    percentFor: (title: string) => `Percentage off ${title}`,
  },
  minimum: {
    heading: 'Minimum requirement',
    none: 'No minimum',
    subtotal: 'Minimum order subtotal',
    subtotalHelp: 'Before the discount and payment fees.',
  },
  eligibility: {
    heading: 'Customer eligibility',
    body: 'Everyone can use this discount. Per-customer caps live under usage limits.',
  },
  usage: {
    heading: 'Usage limits',
    total: 'Limit the total number of uses',
    totalLabel: 'Total uses',
    perCustomer: 'Limit to one use per customer',
    perCustomerHelp: 'Counted by email address.',
  },
  dates: {
    heading: 'Active dates',
    start: 'Start',
    end: 'End',
    setEnd: 'Set an end date',
    tz: 'Times are in your local time zone.',
  },
  summary: {
    heading: 'Summary',
    untitled: 'New discount',
    noCode: 'No code yet',
    automatic: 'Automatic',
    typeAndMethod: 'Type and value',
    details: 'Details',
    forAll: 'For all products',
    forSome: (n: number) => `For ${n} product${n === 1 ? '' : 's'}`,
    minimum: (amount: string) => `Minimum subtotal ${amount}`,
    noMinimum: 'No minimum purchase',
    usesLeft: (used: number, limit: number | null) =>
      limit === null ? `${used} used, no limit` : `${used} of ${limit} used`,
    onePerCustomer: 'One use per customer',
    activeFrom: (d: string) => `Active from ${d}`,
    activeUntil: (d: string) => `until ${d}`,
    activeNow: 'Active from today',
    performance: 'Performance',
    orders: (n: number) => `${n} order${n === 1 ? '' : 's'}`,
    amount: (a: string) => `${a} given away`,
  },
  status: {
    heading: 'Status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'disabled', label: 'Disabled' },
    ],
    help: {
      active: 'Shoppers can use it while the dates and limits allow.',
      disabled: 'Kept for records; shoppers cannot use it.',
    } as Record<string, string>,
  },
  delete: {
    action: 'Delete discount',
    title: (name: string) => `Delete ${name}?`,
    body: 'This cannot be undone. Discounts already used on orders are disabled instead so history stays intact.',
    confirm: 'Delete',
    cancel: 'Cancel',
  },
} as const
