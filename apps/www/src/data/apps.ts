import { siteConfig } from '@commerce/config/site'
import {
  appInstallPath,
  type CatalogueAccessLevel,
  type CatalogueApp,
  type CataloguePrice,
} from '@commerce/core/app-catalogue'
import { formatInr } from '@/lib/pricing-math'

/**
 * The App Store's words. The apps themselves come from `@commerce/core/app-catalogue`, generated
 * from the plugin manifests the admin reads (`bun scripts/gen-app-catalogue.ts`); prices from
 * `APP_PRICING` in `@commerce/core/billing`. Only copy lives here.
 */

const us = siteConfig.brand.name

/**
 * The admin that Install opens. `NEXT_PUBLIC_ADMIN_URL` points a local build at a local admin
 * (`http://localhost:3200`); the deployed site uses the public admin URL.
 */
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || siteConfig.urls.admin

/** The admin's install flow for this app: sign in, pick a store, Connect, Permissions, Done. */
export const installUrl = (id: string) => `${ADMIN_URL}${appInstallPath(id)}`

/** Canonical path of an App Store page on this site. */
export const appPath = (id: string) => `/apps/${id}`
export const categoryPath = (slug: string) => `/apps/category/${slug}`

const CATEGORIES: Record<string, { label: string; title: string; description: string }> = {
  shipping: {
    label: 'Shipping',
    title: 'Courier and shipping apps',
    description:
      'Indian and international couriers: live rates, labels, pickups, tracking and NDR, all in one Shipments workspace.',
  },
  payments: {
    label: 'Payments',
    title: 'Payment apps',
    description: 'UPI, cards, netbanking, wallets and pay later at checkout, beside COD.',
  },
  invoicing: {
    label: 'Invoicing',
    title: 'GST invoicing apps',
    description: 'GST tax invoices, credit notes and GSTR-1 export for Indian stores.',
  },
  marketing: {
    label: 'Marketing',
    title: 'Marketing apps',
    description: 'Reviews, back in stock alerts, EMI prices, forms and A/B tests that sell more.',
  },
  messages: {
    label: 'Messages',
    title: 'Messaging and support apps',
    description: 'Order updates on WhatsApp and email, and live chat with your shoppers.',
  },
  analytics: {
    label: 'Analytics',
    title: 'Analytics apps',
    description: 'Visitors, searches and pages: see how shoppers find and use your store.',
  },
  search: {
    label: 'Search',
    title: 'Store search apps',
    description: 'Search that forgives typos, with synonyms, so shoppers find what they mean.',
  },
  storage: {
    label: 'Storage',
    title: 'File storage apps',
    description: 'Keep your product images and files on your own bucket.',
  },
  operations: {
    label: 'Store operations',
    title: 'Store operations apps',
    description: 'Automate the small jobs on every order, customer and product.',
  },
  migration: {
    label: 'Store migration',
    title: 'Store migration apps',
    description: 'Move your products, customers, orders and pages over from Shopify.',
  },
}

export function categoryCopy(slug: string) {
  return (
    CATEGORIES[slug] ?? {
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      title: `${slug} apps`,
      description: `Apps for your ${us} store.`,
    }
  )
}

const RESOURCES: Record<string, string> = {
  orders: 'Orders',
  'order-events': 'Order updates',
  customers: 'Customers',
  products: 'Products',
  inventory: 'Inventory',
  shipments: 'Shipments',
  payments: 'Payments',
  refunds: 'Refunds',
  invoices: 'Invoices',
  reviews: 'Reviews',
  collections: 'Collections',
  discounts: 'Discounts',
  'gift-cards': 'Gift cards',
  'store-pages': 'Store pages',
  content: 'Content',
  files: 'Files',
  'store-settings': 'Store settings',
  visits: 'Visits',
}

export const resourceLabel = (resource: string) => RESOURCES[resource] ?? resource

const VERBS: Record<CatalogueAccessLevel, string> = {
  read: 'Can see',
  write: 'Can add to',
  'read-write': 'Can see and change',
}

/** One permission in plain words: "Can see and change payments". */
export const accessSentence = (resource: string, level: CatalogueAccessLevel) =>
  `${VERBS[level]} ${resourceLabel(resource).toLowerCase()}`

const planName = (plan: keyof typeof siteConfig.plans) => siteConfig.plans[plan].name
const monthly = (price: Extract<CataloguePrice, { kind: 'paid' }>) =>
  `${formatInr(price.pricePaise / 100)}/month`

/** The chip on a card and in the header: "Free" or "₹149/month". */
export function priceChip(price: CataloguePrice): string {
  return price.kind === 'free' ? 'Free' : monthly(price)
}

/** The line under a paid chip: "Included in Growth and up". Null for free apps. */
export function priceIncluded(price: CataloguePrice): string | null {
  return price.kind === 'free' ? null : `Included in ${planName(price.includedFrom)} and up`
}

/** The price sentence on the app's page and in its FAQ. */
export function priceText(price: CataloguePrice): string {
  if (price.kind === 'free') return 'Free on every plan.'
  return `Included in ${planName(price.includedFrom)} and up. On a smaller plan, ${formatInr(price.pricePaise / 100)} a month + GST.`
}

const PLAN_ORDER = ['starter', 'growth', 'pro'] as const

/** The pricing card's rows: each plan and what the app costs on it. */
export function priceRows(price: CataloguePrice): { plan: string; value: string }[] {
  return PLAN_ORDER.map((plan) => ({
    plan: planName(plan),
    value:
      price.kind === 'free' || PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(price.includedFrom)
        ? 'Included'
        : `${monthly(price)} + GST`,
  }))
}

/** "Koomerce" or "Razorpay": who makes the app. */
export const maker = (app: Pick<CatalogueApp, 'kind' | 'company'>) =>
  app.kind === 'builtin' || !app.company ? us : app.company

/** "by Koomerce" or "by Razorpay". */
export const byline = (app: Pick<CatalogueApp, 'kind' | 'company'>) => `by ${maker(app)}`

/**
 * The app's questions: its own (from the listing), then the ones every app answers from its
 * data: price, the outside account it needs, what leaves the store, and removing it.
 */
export function appFaq(app: CatalogueApp): { question: string; answer: string }[] {
  const shares = app.access.shares
  return [
    ...app.faq,
    { question: 'How much does it cost?', answer: priceText(app.price) },
    ...(app.kind === 'connection' && app.company
      ? [
          {
            question: `Do I need a ${app.company} account?`,
            answer: `Yes. After installing, you connect your own ${app.company} account. Anything ${app.company} charges for its service is between you and ${app.company}.`,
          },
        ]
      : []),
    {
      question: `Does any of my store’s data leave ${us}?`,
      answer:
        shares.length === 0
          ? 'No. The app works inside your store and sends nothing out.'
          : `Only what the app needs. ${shares.map((s) => `${s.when}: ${s.what}.`).join(' ')}`,
    },
    {
      question: 'Can I remove it later?',
      answer:
        'Yes, any time, from Installed apps in your admin. You also see everything it can access before you install it.',
    },
  ]
}

/**
 * Hand-picked rows on the directory's front page. Each names apps by id; an id that is not in
 * the catalogue is skipped, so a row never shows a gap.
 */
export const appCollections = {
  essentials: {
    title: 'Essentials for Indian D2C',
    body: 'What an order needs on its way to the doorstep, in the order it happens.',
    steps: [
      { label: 'Get paid', body: 'UPI, cards and netbanking', ids: ['razorpay', 'decentro'] },
      { label: 'Bill it', body: 'A GST invoice for every order', ids: ['gst-invoices'] },
      {
        label: 'Ship it',
        body: 'Couriers to every PIN code',
        ids: ['delhivery', 'shiprocket', 'india-post'],
      },
      { label: 'Keep shoppers posted', body: 'Order updates on WhatsApp', ids: ['whatsapp'] },
    ],
  },
  ours: {
    title: `Built by ${us}`,
    body: 'Made and looked after by us. No outside account and no extra login.',
  },
}

export const appsContent = {
  metaTitle: 'App Store',
  metaDescription:
    'Every app a store can add: GST invoices, couriers, payments, reviews, back in stock, analytics and more, with what each can access and what it costs.',
  appMetaTitle: (name: string) => `${name} app`,
  heroTitle: 'Apps that run inside your store',
  heroBody: (count: number) =>
    `${count} apps for shipping, payments, GST and more. Each one installs in a click and works in the same admin. Most are free.`,
  search: 'Search apps',
  searchPlaceholder: 'Search couriers, GST, reviews',
  categoriesLabel: 'Categories',
  allApps: 'All',
  filtersLabel: 'Filter apps',
  price: { all: 'Any price', free: 'Free', paid: 'Paid' },
  ours: `Built by ${us}`,
  results: (n: number) => (n === 1 ? '1 app' : `${n} apps`),
  noResultsTitle: (query: string) => (query ? `No apps for “${query}”` : 'No apps match'),
  noResultsBody: 'Try a shorter word, like “courier” or “GST”, or clear the filters.',
  clear: 'Clear search and filters',
  clearSearch: 'Clear search',
  searchKey: 'Press / to search',
  suggestionsLabel: 'Try',
  suggestions: ['courier', 'GST', 'UPI', 'WhatsApp', 'reviews'],
  browse: 'Browse by category',
  seeAll: (n: number) => `See all ${n}`,
  install: 'Install',
  viewDocs: 'View docs',
  installHint: `Opens your ${us} admin. Sign in, pick your store, then agree to what the app can access.`,
  noStore: 'No store yet?',
  startFree: 'Start free',
  breadcrumb: 'Breadcrumb',
  does: 'What it does',
  showcase: 'What it adds to your store',
  storeSide: `Your ${us} store`,
  flowTitle: 'What travels between them',
  flowNothing: 'Nothing leaves your store. The app works on your own data.',
  themeTitle: 'On your storefront',
  themeBody: 'Place it from the theme editor’s Apps tab, wherever you want it.',
  adminNone: 'It works in the background and adds no pages of its own.',
  access: 'What it needs access to',
  accessIntro: 'You see this list and agree to it before the app is added.',
  worksWith: 'Works with',
  needsAccount: (company: string) => `Your own ${company} account`,
  priceTitle: 'Pricing',
  details: 'Details',
  developer: 'Made by',
  category: 'Category',
  builtOn: 'Built on',
  faq: 'Questions',
  related: 'More like this',
  back: 'App Store',
  builtBadge: `Built by ${us}`,
  cta: {
    title: 'Every app, one admin',
    body: 'Start a store and install apps in a click. No developer, no plugins to keep updated.',
  },
}
