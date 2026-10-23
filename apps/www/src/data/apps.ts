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

const LEVELS: Record<CatalogueAccessLevel, string> = {
  read: 'Read',
  write: 'Write',
  'read-write': 'Read and write',
}

export const resourceLabel = (resource: string) => RESOURCES[resource] ?? resource
export const levelLabel = (level: CatalogueAccessLevel) => LEVELS[level]

const planName = (plan: keyof typeof siteConfig.plans) => siteConfig.plans[plan].name

/** The short price on a card: "Free", or "₹199 / month · included in Growth". */
export function priceChip(price: CataloguePrice): string {
  if (price.kind === 'free') return 'Free'
  return `${formatInr(price.pricePaise / 100)} / month · included in ${planName(price.includedFrom)}`
}

/** The price sentence on the app's page. */
export function priceText(price: CataloguePrice): string {
  if (price.kind === 'free') return 'Free on every plan.'
  return `Included in ${planName(price.includedFrom)} and up. On a smaller plan, ${formatInr(price.pricePaise / 100)} / month + GST.`
}

/** "by Koomerce" or "by Razorpay". */
export const byline = (app: Pick<CatalogueApp, 'kind' | 'company'>) =>
  `by ${app.kind === 'builtin' || !app.company ? us : app.company}`

export const appsContent = {
  eyebrow: 'App Store',
  title: 'Add what your store needs',
  subtitle: `Every app works inside ${us}: one admin, one login, no plugins to update. Most are free; a few are included from Growth or Pro.`,
  metaTitle: 'App Store',
  metaDescription:
    'Every app a store can add: GST invoices, couriers, payments, reviews, back in stock, analytics and more, with what each can access and what it costs.',
  appMetaTitle: (name: string) => `${name} app`,
  search: 'Search apps',
  searchPlaceholder: 'Search apps, e.g. courier, GST, reviews',
  categoriesLabel: 'Categories',
  allApps: 'All apps',
  filtersLabel: 'Filter apps',
  price: { all: 'Any price', free: 'Free', paid: 'Paid' },
  ours: `Built by ${us}`,
  results: (n: number) => (n === 1 ? '1 app' : `${n} apps`),
  noResultsTitle: 'No apps match',
  noResultsBody: 'Try another word, or clear the filters.',
  clear: 'Clear filters',
  install: 'Install',
  installHint: `Opens your ${us} admin. Sign in, pick your store, then agree to what the app can access.`,
  noStore: 'No store yet?',
  joinWaitlist: 'Join the waitlist',
  does: 'What it does',
  access: 'What it can access',
  accessIntro: 'You agree to this before the app is added, and can remove it any time.',
  shares: 'What it shares',
  sharesNothing: 'Nothing leaves your store.',
  worksWith: 'Works with',
  needsAccount: (company: string) => `Your own ${company} account`,
  adds: 'Adds to your admin',
  blocks: 'Adds to your theme',
  priceTitle: 'Price',
  guide: 'Read the guide',
  screenshots: 'Screenshots',
  details: 'Details',
  developer: 'Developer',
  category: 'Category',
  builtOn: 'Built on',
  related: 'More like this',
  back: 'All apps',
  cta: {
    title: 'Every app, one admin',
    body: 'Start a store and install apps in a click. No developer, no plugins to keep updated.',
  },
}
