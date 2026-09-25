export const brand = {
  name: 'Waimers Commerce',
  suffix: 'Docs',
}

export const footerLinks = [
  { href: 'https://github.com/Viora-Tech/e-commerce', label: 'GitHub' },
  { href: 'https://github.com/Viora-Tech/e-commerce/issues/new', label: 'Report an issue' },
  { href: '/merchant-guide', label: 'Merchant guide' },
  { href: '/developer-docs/architecture', label: 'Developers' },
]

export const pathCards = [
  {
    href: '/merchant-guide',
    eyebrow: 'I run a store',
    title: 'Merchant guide',
    description:
      'Logging in, orders, shipments, your online store, apps, GST invoices, payments and security. No jargon, short steps.',
  },
  {
    href: '/developer-docs/architecture',
    eyebrow: "I'm building on it",
    title: 'Developer docs',
    description:
      'Architecture, conventions, guardrails, the plugins SDK, the data model, running it locally, testing and backups.',
  },
] as const

export const popularGuides = [
  {
    href: '/merchant-guide/shipments#connecting-delhivery',
    title: 'Connect Delhivery',
    description: 'Paste your API token and pickup location — courier rates and labels in a minute.',
  },
  {
    href: '/merchant-guide/shipments#ready-to-ship',
    title: 'Book your first shipment',
    description: 'Compare rates, print labels and schedule a pickup for paid orders.',
  },
  {
    href: '/merchant-guide/online-store',
    title: 'Edit your store design',
    description: 'Sections, theme settings and app blocks in the online store editor.',
  },
  {
    href: '/merchant-guide/gst-invoices',
    title: 'GST invoices',
    description: 'Tax invoices, credit notes and packing slips generated straight from orders.',
  },
  {
    href: '/merchant-guide/payments',
    title: 'Payments',
    description: 'Turn on payment methods, connect Razorpay and handle unpaid orders.',
  },
  {
    href: '/merchant-guide/apps',
    title: 'Apps',
    description: 'Built-in apps and connections — couriers, gateways, storage and more.',
  },
] as const

export const helpStrip = {
  description: "Can't find what you're looking for, or something looks wrong?",
  links: [
    {
      href: 'https://github.com/Viora-Tech/e-commerce/issues/new',
      label: 'report an issue on GitHub',
    },
    { href: '/developer-docs/running-locally', label: 'run it locally' },
  ],
}
