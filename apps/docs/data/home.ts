export const heroContent = {
  title: 'Waimers Commerce Docs',
  pitch: 'Everything you need to run a store or build on the Waimers Commerce Platform.',
  searchPlaceholder: 'Search guides, settings, API…',
}

export const pathCards = [
  {
    href: '/merchant-guide',
    icon: 'storefront',
    eyebrow: 'I run a store',
    title: 'Merchant guide',
    description:
      'Logging in, orders, shipments, your online store, apps, GST invoices, payments and security. No jargon, short steps.',
    cta: 'Start with Getting started',
  },
  {
    href: '/developer-docs/architecture',
    icon: 'code',
    eyebrow: "I'm building on it",
    title: 'Developer docs',
    description:
      'Architecture, conventions, guardrails, the plugins SDK, the data model, running it locally, testing and backups.',
    cta: 'Start with Architecture',
  },
] as const

export const popularGuides = [
  {
    href: '/merchant-guide/shipments#connecting-delhivery',
    icon: 'truck',
    title: 'Connect Delhivery',
    description: 'Paste your API token and pickup location — courier rates and labels in a minute.',
  },
  {
    href: '/merchant-guide/shipments#ready-to-ship',
    icon: 'package',
    title: 'Book your first shipment',
    description: 'Compare rates, print labels and schedule a pickup for paid orders.',
  },
  {
    href: '/merchant-guide/online-store',
    icon: 'palette',
    title: 'Edit your store design',
    description: 'Sections, theme settings and app blocks in the online store editor.',
  },
  {
    href: '/merchant-guide/gst-invoices',
    icon: 'receipt',
    title: 'GST invoices',
    description: 'Tax invoices, credit notes and packing slips generated straight from orders.',
  },
  {
    href: '/merchant-guide/payments',
    icon: 'card',
    title: 'Payments',
    description: 'Turn on payment methods, connect Razorpay and handle unpaid orders.',
  },
  {
    href: '/merchant-guide/apps',
    icon: 'apps',
    title: 'Apps',
    description: 'Built-in apps and connections — couriers, gateways, storage and more.',
  },
] as const

export const helpStrip = {
  title: 'Need help?',
  description: "Can't find what you're looking for, or something looks wrong?",
  links: [
    { href: 'https://github.com/Viora-Tech/e-commerce/issues/new', label: 'Report an issue' },
    { href: '/developer-docs/running-locally', label: 'Running it locally' },
  ],
}
