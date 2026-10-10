import { siteConfig } from '@commerce/config/site'

export const brand = {
  name: siteConfig.brand.name,
  suffix: 'Docs',
}

export const footerLinks = [
  { href: 'https://github.com/Viora-Tech/e-commerce', label: 'GitHub' },
  { href: 'https://github.com/Viora-Tech/e-commerce/issues/new', label: 'Report an issue' },
  { href: '/merchant-guide/start-here/welcome', label: 'Merchant guide' },
  { href: '/developer-docs/getting-started/architecture', label: 'Developers' },
]

export const pathCards = [
  {
    href: '/merchant-guide/start-here/welcome',
    icon: 'storefront',
    title: 'Merchant guide',
    description: 'Run your store: orders, shipping, payments and GST, in short steps.',
  },
  {
    href: '/developer-docs/getting-started/architecture',
    icon: 'code',
    title: 'Developers',
    description: 'Architecture, conventions, the plugins SDK and running it locally.',
  },
] as const

/** The "I want to…" cards on the home page: one per thing a merchant comes here to do. */
export const taskCards = [
  {
    href: '/merchant-guide/start-here/set-up-your-store',
    icon: 'checklist',
    title: 'Set up my store',
    description: 'The day-one checklist, from GSTIN to your first test order.',
  },
  {
    href: '/merchant-guide/start-here/move-from-shopify',
    icon: 'swap',
    title: 'Move from Shopify',
    description: 'Bring products, customers, orders and your theme across.',
  },
  {
    href: '/merchant-guide/products/products-collections',
    icon: 'package',
    title: 'Add products',
    description: 'Variants, prices, HSN codes, stock and collections.',
  },
  {
    href: '/merchant-guide/orders/shipments',
    icon: 'truck',
    title: 'Ship orders',
    description: 'Compare rates, print labels and schedule a pickup.',
  },
  {
    href: '/merchant-guide/money-and-gst/payments',
    icon: 'creditCard',
    title: 'Get paid',
    description: 'Turn on payment methods and connect Razorpay.',
  },
  {
    href: '/merchant-guide/online-store/website-builder',
    icon: 'paintbrush',
    title: 'Change my website',
    description: 'Sections, theme settings and app blocks in the editor.',
  },
  {
    href: '/merchant-guide/analytics/overview',
    icon: 'chart',
    title: 'See my sales',
    description: 'Sales, reports and where your orders come from.',
  },
  {
    href: '/merchant-guide/money-and-gst/gst-invoices',
    icon: 'receipt',
    title: 'Send GST invoices',
    description: 'Tax invoices, credit notes and packing slips from orders.',
  },
] as const

export type HomeCardIcon = (typeof pathCards)[number]['icon'] | (typeof taskCards)[number]['icon']

export const helpStrip = {
  description: "Can't find what you're looking for, or something looks wrong?",
  links: [
    {
      href: 'https://github.com/Viora-Tech/e-commerce/issues/new',
      label: 'report an issue on GitHub',
    },
    { href: '/developer-docs/getting-started/running-locally', label: 'run it locally' },
  ],
}
