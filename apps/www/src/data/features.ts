import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name
const docs = siteConfig.urls.docs

export type FeatureGroup = 'sell' | 'ship' | 'grow' | 'run'

export type FeatureModule = {
  key: string
  title: string
  summary: string
  group: FeatureGroup
  headline: string
  bullets: readonly [string, string, string]
  guideHref: string
  /** A real admin screenshot, only where one exists in the design. */
  screen?: { src: string; alt: string; width: number; height: number; url: string }
}

export const featuresContent = {
  eyebrow: 'Features',
  title: 'Every module, one admin.',
  subtitle: `Pick a module to see the real screen. Everything here ships inside ${brand} — no app store hunting.`,
  filters: [
    { key: 'all', label: 'All 14' },
    { key: 'sell', label: 'Sell' },
    { key: 'ship', label: 'Ship' },
    { key: 'grow', label: 'Grow' },
    { key: 'run', label: 'Run' },
  ],
  filterLabel: 'Filter modules',
  seeInTour: 'See it in the tour',
  readGuide: 'Read the guide',
  tourHref: '/#tour',
  modules: [
    {
      key: 'orders',
      title: 'Orders',
      summary: 'Every order, payment and next step.',
      group: 'sell',
      headline: 'Know exactly what to do next.',
      bullets: [
        'Every order with its payment and fulfilment status, colour-coded.',
        'A next-step banner on each order — ship, refund or follow up.',
        'Create the shipment and print the label without leaving the order.',
      ],
      guideHref: `${docs}/merchant-guide/orders/orders`,
      screen: {
        src: '/images/screen-orders.png',
        alt: 'The Orders page with every order, payment and next step',
        width: 696,
        height: 498,
        url: `${siteConfig.brand.domain}/admin/orders`,
      },
    },
    {
      key: 'products',
      title: 'Products',
      summary: 'Variants, media, SEO and bulk edits.',
      group: 'sell',
      headline: 'Add it once. Sell it everywhere.',
      bullets: [
        'Variants, options and media in one editor.',
        'Edit hundreds of products at once from a spreadsheet-style table.',
        'Import from Shopify, with collections and SEO fields kept.',
      ],
      guideHref: `${docs}/merchant-guide/products/products-collections`,
    },
    {
      key: 'stock',
      title: 'Stock',
      summary: 'Locations, suppliers, purchase orders.',
      group: 'ship',
      headline: 'Never sell what you do not have.',
      bullets: [
        'Stock across locations, with low-stock alerts.',
        'Suppliers and purchase orders in the same admin.',
        'Transfers between locations, tracked end to end.',
      ],
      guideHref: `${docs}/merchant-guide/stock`,
      screen: {
        src: '/images/screen-stock.png',
        alt: 'The Stock page with inventory levels',
        width: 805,
        height: 465,
        url: `${siteConfig.brand.domain}/admin/stock`,
      },
    },
    {
      key: 'customers',
      title: 'Customers',
      summary: 'Profiles, segments, consent.',
      group: 'grow',
      headline: 'Know who is buying.',
      bullets: [
        'A profile per customer with their orders and addresses.',
        'Segments you can message in one click.',
        'Consent recorded per channel, so you only message people who said yes.',
      ],
      guideHref: `${docs}/merchant-guide/customers`,
    },
    {
      key: 'analytics',
      title: 'Analytics',
      summary: 'Reports, profit and Live view.',
      group: 'run',
      headline: 'See the numbers that matter.',
      bullets: [
        'Sales, orders and profit by day, product and channel.',
        'Live view: orders and visitors arriving on a globe.',
        'Reports you can export to a spreadsheet.',
      ],
      guideHref: `${docs}/merchant-guide/analytics`,
    },
    {
      key: 'growth',
      title: 'Growth',
      summary: 'Campaigns, automations, short links.',
      group: 'grow',
      headline: 'Bring customers back.',
      bullets: [
        'Email and WhatsApp campaigns to a segment.',
        'Automations that follow up on carts, orders and reviews.',
        'Short links that count clicks and orders.',
      ],
      guideHref: `${docs}/merchant-guide/growth/overview`,
    },
    {
      key: 'discounts',
      title: 'Discounts',
      summary: 'Codes and automatic discounts.',
      group: 'sell',
      headline: 'Offers that apply themselves.',
      bullets: [
        'Codes and automatic discounts on products, collections or carts.',
        'Limits per customer, per code and by date.',
        'See what each discount earned.',
      ],
      guideHref: `${docs}/merchant-guide/discounts`,
    },
    {
      key: 'online-store',
      title: 'Online store',
      summary: 'Themes, editor, Shopify import.',
      group: 'sell',
      headline: 'Your look, your way.',
      bullets: [
        'Click any text to edit it, with sections and version history.',
        'Upload your Shopify theme and keep the look.',
        'A checkout themes cannot break.',
      ],
      guideHref: `${docs}/merchant-guide/online-store/website-builder`,
    },
    {
      key: 'content',
      title: 'Content',
      summary: 'Files, blog, pages, content types.',
      group: 'grow',
      headline: 'Words and pictures, in one place.',
      bullets: [
        'A file library for images, video and downloads.',
        'Blog posts and pages with a simple editor.',
        'Your own content types for anything else.',
      ],
      guideHref: `${docs}/merchant-guide/content`,
    },
    {
      key: 'apps',
      title: 'Apps',
      summary: 'Built-in apps and connections.',
      group: 'run',
      headline: 'Add what you need, built in.',
      bullets: [
        'Couriers, payment gateways, reviews and EMI as built-in apps.',
        'Connect a service in about a minute.',
        'No separate bills for the basics.',
      ],
      guideHref: `${docs}/merchant-guide/apps/app-store`,
    },
    {
      key: 'ai',
      title: `${brand} AI`,
      summary: 'Ask anything; approve every change.',
      group: 'grow',
      headline: 'Ask in plain words.',
      bullets: [
        'Ask about your store and get answers from your own data.',
        'It prepares changes and shows exactly what will happen.',
        'Nothing is saved until you approve it.',
      ],
      guideHref: `${docs}/merchant-guide/home/ask-ai`,
    },
    {
      key: 'checkout',
      title: 'Checkout',
      summary: 'UPI first, cards, EMI, COD.',
      group: 'sell',
      headline: 'The way India pays.',
      bullets: [
        'UPI on top, then cards, EMI, netbanking and cash on delivery.',
        'Razorpay, Cashfree or Decentro behind it.',
        'COD confirmed on WhatsApp before you ship.',
      ],
      guideHref: `${docs}/merchant-guide/money-and-gst/payments`,
    },
    {
      key: 'shipping',
      title: 'Shipping',
      summary: 'Delhivery, Shiprocket, RapidShyp.',
      group: 'ship',
      headline: 'Compare, book, print.',
      bullets: [
        'Compare courier rates for a PIN code.',
        'Book the pickup from the order and print the label.',
        'Tracking updates flow back to the order.',
      ],
      guideHref: `${docs}/merchant-guide/apps/couriers`,
    },
    {
      key: 'gst',
      title: 'GST',
      summary: 'CGST/SGST/IGST, invoices per GSTIN.',
      group: 'run',
      headline: 'GST, done right.',
      bullets: [
        'CGST and SGST inside your state, IGST across states.',
        'Invoices per GST number, with several warehouses.',
        'Download invoices in bulk for your accountant.',
      ],
      guideHref: `${docs}/merchant-guide/money-and-gst/gst-invoices`,
    },
  ] satisfies readonly FeatureModule[],
  cta: {
    title: 'All of it, on day one.',
    body: 'Every core module is on every plan. Plans differ by orders, staff, AI credits and a few apps.',
  },
}
