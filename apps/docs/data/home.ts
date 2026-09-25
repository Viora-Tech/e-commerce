export const brand = {
  name: 'Waimers Commerce',
  suffix: 'Docs',
}

export const footerLinks = [
  { href: 'https://github.com/Viora-Tech/e-commerce', label: 'GitHub' },
  { href: 'https://github.com/Viora-Tech/e-commerce/issues/new', label: 'Report an issue' },
  { href: '/merchant-guide', label: 'Merchant guide' },
  { href: '/developer-docs/building/architecture', label: 'Developers' },
]

export const pathCards = [
  {
    href: '/merchant-guide',
    icon: 'storefront',
    title: 'Merchant guide',
    description: 'Run your store: orders, shipping, payments and GST, in short steps.',
  },
  {
    href: '/developer-docs/building/architecture',
    icon: 'code',
    title: 'Developers',
    description: 'Architecture, conventions, the plugins SDK and running it locally.',
  },
] as const

export const popularGuides = [
  {
    href: '/merchant-guide/selling/shipments#connect-a-courier',
    icon: 'plugs',
    title: 'Connect Delhivery',
    description: 'Paste your API token and pickup location to get rates and labels.',
  },
  {
    href: '/merchant-guide/selling/shipments#ship-orders-step-by-step',
    icon: 'truck',
    title: 'Book your first shipment',
    description: 'Compare rates, print labels and schedule a pickup.',
  },
  {
    href: '/merchant-guide/selling/online-store',
    icon: 'paintbrush',
    title: 'Edit your store design',
    description: 'Sections, theme settings and app blocks in the editor.',
  },
  {
    href: '/merchant-guide/money/gst-invoices',
    icon: 'receipt',
    title: 'GST invoices',
    description: 'Tax invoices, credit notes and packing slips from orders.',
  },
  {
    href: '/merchant-guide/money/payments',
    icon: 'creditCard',
    title: 'Payments',
    description: 'Turn on payment methods and connect Razorpay.',
  },
  {
    href: '/merchant-guide/set-up-your-store',
    icon: 'checklist',
    title: 'Set up your store',
    description: 'The day-one checklist, from GSTIN to your first test order.',
  },
] as const

export type HomeCardIcon =
  | (typeof pathCards)[number]['icon']
  | (typeof popularGuides)[number]['icon']

export const helpStrip = {
  description: "Can't find what you're looking for, or something looks wrong?",
  links: [
    {
      href: 'https://github.com/Viora-Tech/e-commerce/issues/new',
      label: 'report an issue on GitHub',
    },
    { href: '/developer-docs/operations/running-locally', label: 'run it locally' },
  ],
}
