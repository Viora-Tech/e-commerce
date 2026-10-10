/**
 * Every guide a "Related guides" block can point at, keyed by a short id. Pages list ids
 * (`<RelatedGuides ids={['orders', 'payments']} />`) so titles and one-liners are written
 * once, here.
 */
export const guides = {
  'getting-started': {
    href: '/merchant-guide',
    icon: 'rocket',
    title: 'Getting started',
    description: 'Log in with a one-time code, pick a store, read the dashboard.',
  },
  'set-up': {
    href: '/merchant-guide/set-up-your-store',
    icon: 'checklist',
    title: 'Set up your store',
    description: 'The day-one checklist: details, GSTIN, products, payments, shipping.',
  },
  'going-live': {
    href: '/merchant-guide/going-live',
    icon: 'flag',
    title: 'Going live',
    description: 'Everything to check before you share your store link.',
  },
  products: {
    href: '/merchant-guide/catalog/products-collections',
    icon: 'package',
    title: 'Products and collections',
    description: 'Variants, prices, HSN codes, stock, pre-orders and collections.',
  },
  orders: {
    href: '/merchant-guide/catalog/orders',
    icon: 'receipt',
    title: 'Orders',
    description: 'Order, payment and fulfilment statuses, and what to do next.',
  },
  customers: {
    href: '/merchant-guide/catalog/customers',
    icon: 'book',
    title: 'Customers',
    description: 'Edit a customer and keep their saved addresses up to date.',
  },
  settings: {
    href: '/merchant-guide/settings',
    icon: 'checklist',
    title: 'Settings',
    description: 'The setup checklist, the six settings groups, search, and your store details.',
  },
  notifications: {
    href: '/merchant-guide/settings/notifications',
    icon: 'sparkle',
    title: 'Notifications',
    description: 'The messages customers get, previews, tests, and email or WhatsApp.',
  },
  'sender-email': {
    href: '/merchant-guide/settings/sender-email',
    icon: 'sparkle',
    title: 'Send emails from your own address',
    description: 'support@yourshop.in on every email: the DNS records and where to add them.',
  },
  shipping: {
    href: '/merchant-guide/settings/shipping',
    icon: 'truck',
    title: 'Shipping & delivery',
    description: 'Delivery prices, your boxes, when orders go out, which courier ships.',
  },
  shipments: {
    href: '/merchant-guide/selling/shipments',
    icon: 'truck',
    title: 'Shipments',
    description: 'Connect a courier, book, print labels, pickups and delivery problems.',
  },
  returns: {
    href: '/merchant-guide/selling/returns',
    icon: 'receipt',
    title: 'Returns and RTO',
    description:
      'Return rules, handling a return from request to refund, and parcels that come back.',
  },
  'online-store': {
    href: '/merchant-guide/selling/online-store',
    icon: 'paintbrush',
    title: 'Online store',
    description: 'Themes, the editor, sections, app blocks, saving and publishing.',
  },
  apps: {
    href: '/merchant-guide/selling/apps',
    icon: 'puzzle',
    title: 'Apps',
    description: 'Built-in apps and connections: install, set up, uninstall.',
  },
  growth: {
    href: '/merchant-guide/selling/growth',
    icon: 'sparkle',
    title: 'Growth',
    description: 'Sales by source, tagged links, campaigns and automations.',
  },
  reports: {
    href: '/merchant-guide/selling/reports',
    icon: 'sparkle',
    title: 'Reports',
    description:
      'Ask a question in plain words, save the reports you check often, start from templates.',
  },
  payments: {
    href: '/merchant-guide/money/payments',
    icon: 'card',
    title: 'Payments',
    description: 'Get paid online, ways to pay, the ₹1 test order, fees and unpaid-order rules.',
  },
  cashfree: {
    href: '/merchant-guide/money/cashfree',
    icon: 'card',
    title: 'Cashfree',
    description: 'Connect Cashfree with two keys; no webhook to set up.',
  },
  'emi-pay-later': {
    href: '/merchant-guide/money/emi-pay-later',
    icon: 'card',
    title: 'EMI & pay later',
    description: 'Show "or ₹X/month" under product prices, with Razorpay or Cashfree.',
  },
  gst: {
    href: '/merchant-guide/money/gst-invoices',
    icon: 'invoice',
    title: 'GST invoices',
    description: 'Tax invoices, credit notes, numbering and GSTR-1 export.',
  },
  security: {
    href: '/merchant-guide/money/security',
    icon: 'shield',
    title: 'Security and data protection',
    description: 'Logins, store isolation, encrypted secrets and backups.',
  },
  glossary: {
    href: '/merchant-guide/reference/glossary',
    icon: 'book',
    title: 'Glossary',
    description: 'AWB, NDR, RTO, GSTIN, HSN and other words you will see.',
  },
  'whats-new': {
    href: '/merchant-guide/reference/whats-new',
    icon: 'sparkle',
    title: "What's new",
    description: 'Everything we shipped, grouped by area.',
  },
  architecture: {
    href: '/developer-docs/building/architecture',
    icon: 'stack',
    title: 'Architecture',
    description: 'The three apps, tenancy, workflows and the scale roadmap.',
  },
  'request-flow': {
    href: '/developer-docs/building/request-flow',
    icon: 'flow',
    title: 'Request flow',
    description: 'One request, end to end: host, store, RLS, workflow, worker.',
  },
  'first-app': {
    href: '/developer-docs/building/first-app',
    icon: 'code',
    title: 'Build your first app',
    description: 'Manifest, admin page, app block and settings in 15 minutes.',
  },
  plugins: {
    href: '/developer-docs/building/plugins',
    icon: 'plugs',
    title: 'Plugins SDK and app blocks',
    description: 'The full SDK reference: providers, hooks, jobs, pages, blocks.',
  },
  'data-model': {
    href: '/developer-docs/building/data-model',
    icon: 'database',
    title: 'Data model',
    description: 'Main tables, relationships, roles and RLS.',
  },
  'dev-security': {
    href: '/developer-docs/building/security',
    icon: 'shield',
    title: 'Security',
    description: 'Encryption, key rotation, backups and access control.',
  },
  'running-locally': {
    href: '/developer-docs/operations/running-locally',
    icon: 'terminal',
    title: 'Running locally',
    description: 'Env, Docker, migrate, seed and run the three apps.',
  },
} as const

export type GuideId = keyof typeof guides
export type GuideIcon = (typeof guides)[GuideId]['icon']

export const relatedGuidesCopy = {
  heading: 'Related guides',
}

export const videoTipCopy = {
  label: 'Video tip',
  placeholder: 'Coming soon: a 30-second video',
}

export const screenshotCopy = {
  label: 'Screenshot',
  placeholder: 'Placeholder, not a real screenshot yet',
}

export const readingTimeCopy = {
  suffix: 'min read',
}
