import { siteConfig } from '@commerce/config/site'

/**
 * The public App Store: every app a store can add, what it does, what it can access, and what it
 * costs. Install opens the admin's install flow for the store the visitor is signed in to
 * (`/apps/install?app=<id>`, apps/admin). Prices follow memory-bank/pricing.md and
 * `APP_PRICING` in `@commerce/core/billing`; keep the three in step.
 */

export type AppCategory =
  | 'invoicing'
  | 'shipping'
  | 'payments'
  | 'marketing'
  | 'analytics'
  | 'search'
  | 'messages'
  | 'storage'
  | 'import'

/** `free` on every plan, or included from a plan up and bought monthly below it. */
export type AppPricing =
  | { kind: 'free' }
  | { kind: 'paid'; includedFrom: 'Growth' | 'Pro'; perMonth: string }

export type StoreApp = {
  id: string
  name: string
  /** Made by us, or the outside company a connection links to. */
  by: string
  category: AppCategory
  blurb: string
  does: string[]
  /** What it can see and change in the store, in plain words. */
  access: string[]
  /** What it sends to an outside company, if anything. */
  shares: string | null
  pricing: AppPricing
  /** Merchant guide for the app, under the docs site. */
  guide: string | null
}

const us = siteConfig.brand.name
const docs = siteConfig.urls.docs

export const installUrl = (id: string) =>
  `https://${siteConfig.brand.domain}/apps/install?app=${encodeURIComponent(id)}`

export const STORE_APPS: StoreApp[] = [
  {
    id: 'gst-invoices',
    name: 'GST invoices',
    by: us,
    category: 'invoicing',
    blurb: 'Tax invoices, credit notes and GSTR-1 export, per GST number.',
    does: [
      'Issues a GST invoice when an order is paid, numbered per GSTIN',
      'Credit notes for returns and cancellations',
      'GSTR-1 export for your accountant',
    ],
    access: ['Orders · read', 'Settings · read'],
    shares: null,
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/money-and-gst/gst-invoices`,
  },
  {
    id: 'reviews',
    name: 'Reviews',
    by: us,
    category: 'marketing',
    blurb: 'Product reviews with photos, verified buyer badges and review request emails.',
    does: [
      'Review request emails after delivery',
      'Photos, verified buyer badges and your replies',
      'Import your reviews from Judge.me',
    ],
    access: ['Products · read', 'Orders · read', 'Customers · read'],
    shares: null,
    pricing: { kind: 'paid', includedFrom: 'Growth', perMonth: '₹199' },
    guide: `${docs}/merchant-guide/apps/reviews`,
  },
  {
    id: 'back-in-stock',
    name: 'Back in stock',
    by: us,
    category: 'marketing',
    blurb: 'A "Notify me" button on sold-out products, and an alert when they are back.',
    does: [
      'A Notify me block for sold-out products',
      'Emails shoppers the moment stock returns',
      'Signups and how many came back to buy',
    ],
    access: ['Products · read', 'Inventory · read'],
    shares: null,
    pricing: { kind: 'paid', includedFrom: 'Growth', perMonth: '₹149' },
    guide: `${docs}/merchant-guide/apps/back-in-stock`,
  },
  {
    id: 'forms',
    name: 'Forms',
    by: us,
    category: 'marketing',
    blurb: 'Makes the contact forms of an imported theme work, with every message saved.',
    does: ['Saves every message on a Submissions page', 'Emails each one to your store'],
    access: ['Content · read'],
    shares: null,
    pricing: { kind: 'paid', includedFrom: 'Growth', perMonth: '₹99' },
    guide: null,
  },
  {
    id: 'emi-pay-later',
    name: 'EMI & pay later',
    by: us,
    category: 'payments',
    blurb: '"Or ₹X/month" under product prices, and an EMI offers block.',
    does: ['Shows the lowest EMI under each price', 'An EMI offers block for product pages'],
    access: ['Products · read'],
    shares: null,
    pricing: { kind: 'paid', includedFrom: 'Pro', perMonth: '₹149' },
    guide: `${docs}/merchant-guide/apps/emi-and-pay-later`,
  },
  {
    id: 'google-search-console',
    name: 'Google Search Console',
    by: 'Google',
    category: 'analytics',
    blurb: 'The Google searches that find you, pages almost on page 1, and sitemaps.',
    does: [
      'Top searches and top pages, every day',
      'Pages almost on page 1, and pages losing clicks',
      'Submits your sitemap',
    ],
    access: ['Products · read', 'Content · read'],
    shares: 'Your store address, to read its Search Console data',
    pricing: { kind: 'paid', includedFrom: 'Pro', perMonth: '₹199' },
    guide: `${docs}/merchant-guide/apps/google-search-console`,
  },
  {
    id: 'umami',
    name: 'Umami',
    by: 'Umami',
    category: 'analytics',
    blurb: 'Visitor analytics without cookies, inside Analytics.',
    does: ['Visitors, pages and sources on the Analytics page', 'No cookie banner needed'],
    access: ['Analytics · read'],
    shares: 'Page views, without personal details',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/analytics/visitor-analytics`,
  },
  {
    id: 'meilisearch',
    name: 'Meilisearch',
    by: 'Meilisearch',
    category: 'search',
    blurb: 'Fast store search that forgives typos, with your own synonyms.',
    does: [
      'Finds “t-shrit” and “tee” alike',
      'Search box suggestions as shoppers type',
      'Your store’s own search takes over if Meilisearch is down',
    ],
    access: ['Products · read', 'Collections · read'],
    shares: 'Product details and the words shoppers search for, to your Meilisearch server',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/apps/meilisearch`,
  },
  {
    id: 'chatwoot',
    name: 'Chatwoot',
    by: 'Chatwoot',
    category: 'messages',
    blurb: 'Live chat and a shared support inbox, with each shopper’s orders beside the chat.',
    does: [
      'Chat on every page of your store, in your own theme or an imported one',
      'Signed-in shoppers arrive with their name, orders and total spent',
      'Their conversations on the customer and order pages',
    ],
    access: ['Customers · read', 'Orders · read'],
    shares: 'Customer name, email, phone and order totals, to your Chatwoot',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/apps/chatwoot`,
  },
  {
    id: 'shopify-import',
    name: 'Shopify importer',
    by: us,
    category: 'import',
    blurb: 'Products, customers, orders, pages, menus and more, moved over from Shopify.',
    does: [
      'Products, collections, customers and orders',
      'Pages, blog posts, menus, redirects and files',
      'Discounts and gift card balances',
    ],
    access: ['Products · read & write', 'Customers · read & write', 'Orders · read & write'],
    shares: null,
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/start-here/move-from-shopify`,
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    by: 'Delhivery',
    category: 'shipping',
    blurb: 'Rates, labels, pickups and tracking, plus a delivery checker block.',
    does: ['Live rates and labels', 'Pickups and tracking updates', 'Pincode delivery checker'],
    access: ['Orders · read & write'],
    shares: 'Delivery address and parcel details for each shipment',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/orders/shipments`,
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    by: 'Shiprocket',
    category: 'shipping',
    blurb: 'Many couriers through one account: rates, labels and tracking.',
    does: ['Compare courier rates', 'Labels and tracking', 'Pincode delivery checker'],
    access: ['Orders · read & write'],
    shares: 'Delivery address and parcel details for each shipment',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/orders/shipments`,
  },
  {
    id: 'rapidshyp',
    name: 'RapidShyp',
    by: 'RapidShyp',
    category: 'shipping',
    blurb: 'Multi-courier rates, labels, pickups and tracking.',
    does: ['Courier rates and labels', 'Pickups', 'Tracking on a schedule'],
    access: ['Orders · read & write'],
    shares: 'Delivery address and parcel details for each shipment',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/orders/shipments`,
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    by: 'Razorpay',
    category: 'payments',
    blurb: 'Cards, UPI and netbanking, with UPI confirmed automatically.',
    does: ['Cards, UPI and netbanking at checkout', 'A UPI QR per order, confirmed for you'],
    access: ['Orders · read & write'],
    shares: 'Order amount and the shopper’s contact for each payment',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/money-and-gst/payments`,
  },
  {
    id: 'cashfree',
    name: 'Cashfree',
    by: 'Cashfree Payments',
    category: 'payments',
    blurb: 'UPI, cards, netbanking, wallets and pay later.',
    does: ['UPI, cards and netbanking', 'Wallets and pay later'],
    access: ['Orders · read & write'],
    shares: 'Order amount and the shopper’s contact for each payment',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/money-and-gst/cashfree`,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    by: 'Meta',
    category: 'messages',
    blurb: 'Order updates on WhatsApp through the Meta Cloud API.',
    does: ['Order confirmed, shipped and delivered messages', 'Your own WhatsApp number'],
    access: ['Orders · read', 'Customers · read'],
    shares: 'The shopper’s phone number and order status',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/settings/notifications`,
  },
  {
    id: 'ses',
    name: 'Amazon SES email',
    by: 'Amazon Web Services',
    category: 'messages',
    blurb: 'Sends your order emails through your own Amazon SES account.',
    does: ['Order emails from your own address', 'Your own sending limits'],
    access: ['Orders · read', 'Customers · read'],
    shares: 'The shopper’s email and the email content',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/settings/sender-email`,
  },
  {
    id: 'r2',
    name: 'Cloudflare R2',
    by: 'Cloudflare',
    category: 'storage',
    blurb: 'Keeps your images and files on your own R2 bucket.',
    does: ['Your files on your own bucket', 'Moves existing files over safely'],
    access: ['Content · read & write'],
    shares: 'Your store’s images and files',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/content/files-and-storage`,
  },
  {
    id: 's3',
    name: 'Amazon S3',
    by: 'Amazon Web Services',
    category: 'storage',
    blurb: 'Keeps your images and files on your own S3 bucket, with CloudFront if you like.',
    does: ['Guided bucket and key setup', 'Moves existing files over safely'],
    access: ['Content · read & write'],
    shares: 'Your store’s images and files',
    pricing: { kind: 'free' },
    guide: `${docs}/merchant-guide/content/files-and-storage`,
  },
]

export const appsContent = {
  eyebrow: 'App Store',
  title: 'Add what your store needs',
  subtitle: `Every app works inside ${us}: one admin, one login, no plugins to update. Most are free; a few are included from Growth or Pro.`,
  filterLabel: 'Filter apps',
  filters: [
    { key: 'all', label: 'All' },
    { key: 'invoicing', label: 'Invoicing' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'payments', label: 'Payments' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'search', label: 'Search' },
    { key: 'messages', label: 'Messages' },
    { key: 'storage', label: 'Storage' },
    { key: 'import', label: 'Import' },
  ] as const,
  by: (who: string) => `by ${who}`,
  free: 'Free',
  paid: (price: string, plan: string) => `${price} / month · included in ${plan}`,
  install: 'Install',
  installHint: `Opens your ${us} admin and adds the app to your store.`,
  noStore: 'No store yet?',
  joinWaitlist: 'Join the waitlist',
  does: 'What it does',
  access: 'What it can access',
  shares: 'What it shares',
  sharesNothing: 'Nothing leaves your store.',
  price: 'Price',
  priceFree: 'Free on every plan',
  pricePaid: (price: string, plan: string) =>
    `Included in ${plan} and up. On a smaller plan, ${price} / month + GST.`,
  guide: 'Read the guide',
  back: 'All apps',
  cta: {
    title: 'Every app, one admin',
    body: 'Start a store and install apps in a click. No developer, no plugins to keep updated.',
  },
}
