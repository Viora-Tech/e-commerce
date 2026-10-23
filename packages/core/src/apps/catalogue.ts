/** SOURCE OF TRUTH: the public app catalogue — WHAT: every app the App Store site lists, with its listing, access, logo and price / WHY: the App Store site (apps/www) and the admin read the same apps, generated from the plugin manifests, so no second app list drifts */
/**
 * The App Store catalogue, pure and client-safe (`@commerce/core/app-catalogue`). The entries
 * come from `catalogue.generated.ts`, which `bun scripts/gen-app-catalogue.ts` writes from the
 * manifests in `commerce.config.ts` (the `app-catalogue` sweep fails when it is stale). Prices
 * come from `APP_PRICING` (`../billing/apps`), so a price changes in one place.
 *
 * Built-in Koomerce apps only for now. A third-party app later becomes one more entry with
 * `kind: 'connection'` and its own `company`, installed through the same `/apps/install?app=<id>`.
 */
import { APP_PRICING } from '../billing/apps'
import type { PlanId } from '../billing/plans'
import { APP_CATALOGUE_DATA } from './catalogue.generated'

export { APP_LOGOS } from './logos'

export type CatalogueAccessLevel = 'read' | 'write' | 'read-write'

/** One app as the manifests describe it (what the generator writes). */
export type CatalogueEntry = {
  id: string
  name: string
  /** `builtin`: made by us, no outside account. `connection`: links to another company's service. */
  kind: 'builtin' | 'connection'
  category: string
  /** The outside company for a `connection`; null for our own apps. */
  company: string | null
  description: string
  tagline: string
  highlights: string[]
  /** Path under the docs site, or null. */
  guide: string | null
  worksWith: string[]
  screenshots: { src: string; alt: string }[]
  keywords: string[]
  /** The app's own questions and answers, from its listing. */
  faq: { question: string; answer: string }[]
  /** The admin icon name (`Star`, `FileText`), drawn on the tile when there is no logo; or null. */
  icon: string | null
  access: {
    resources: { resource: string; level: CatalogueAccessLevel; why: string }[]
    shares: { when: string; what: string }[]
  }
  /** The admin pages the app adds (their nav labels). */
  adminPages: string[]
  /** Theme blocks the app adds (their labels). */
  themeBlocks: string[]
  credits: { name: string; url: string; license: string }[]
}

export type CataloguePrice =
  | { kind: 'free' }
  | { kind: 'paid'; includedFrom: PlanId; pricePaise: number }

export type CatalogueApp = CatalogueEntry & { price: CataloguePrice }

/** Categories in the order the App Store shows them; any other category sorts after these. */
export const APP_CATEGORIES = [
  'shipping',
  'payments',
  'invoicing',
  'marketing',
  'operations',
  'messages',
  'analytics',
  'search',
  'storage',
  'migration',
] as const

/** Free on every plan, or included from a plan up and bought monthly below it. */
export function appPrice(id: string): CataloguePrice {
  const price = APP_PRICING[id]
  return price
    ? { kind: 'paid', includedFrom: price.includedFrom, pricePaise: price.pricePaise }
    : { kind: 'free' }
}

const categoryRank = (category: string) => {
  const i = (APP_CATEGORIES as readonly string[]).indexOf(category)
  return i === -1 ? APP_CATEGORIES.length : i
}

/** Every listed app with its price: our own apps first, then by name. */
export function catalogueApps(): CatalogueApp[] {
  return APP_CATALOGUE_DATA.map((app) => ({ ...app, price: appPrice(app.id) })).sort(
    (a, b) =>
      Number(a.kind === 'connection') - Number(b.kind === 'connection') ||
      a.name.localeCompare(b.name),
  )
}

export function catalogueApp(id: string): CatalogueApp | null {
  return catalogueApps().find((a) => a.id === id) ?? null
}

/** The categories that have apps, in `APP_CATEGORIES` order, with how many each has. */
export function catalogueCategories(
  apps: CatalogueApp[] = catalogueApps(),
): { slug: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const app of apps) counts.set(app.category, (counts.get(app.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => categoryRank(a.slug) - categoryRank(b.slug) || a.slug.localeCompare(b.slug))
}

export type CatalogueFilter = {
  query?: string | undefined
  category?: string | null | undefined
  price?: 'all' | 'free' | 'paid' | undefined
  /** Only apps made by us. */
  ours?: boolean | undefined
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** True when every word of `query` is in the app's name, company, tagline, highlights or keywords. */
export function matchesAppQuery(app: CatalogueEntry, query: string): boolean {
  const words = normalise(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalise(
    [
      app.name,
      app.company ?? '',
      app.category,
      app.tagline,
      app.description,
      ...app.highlights,
      ...app.keywords,
    ].join(' '),
  )
  return words.every((w) => haystack.includes(w))
}

export function filterCatalogue(apps: CatalogueApp[], filter: CatalogueFilter): CatalogueApp[] {
  return apps.filter(
    (app) =>
      matchesAppQuery(app, filter.query ?? '') &&
      (!filter.category || app.category === filter.category) &&
      (!filter.price || filter.price === 'all' || app.price.kind === filter.price) &&
      (!filter.ours || app.kind === 'builtin'),
  )
}

/** Other apps in the same category, for "More like this". */
export function relatedApps(app: CatalogueApp, limit = 3): CatalogueApp[] {
  return catalogueApps()
    .filter((a) => a.id !== app.id && a.category === app.category)
    .slice(0, limit)
}

/** The admin's install flow for one app: sign-in and store choice come first. */
export const appInstallPath = (id: string) => `/apps/install?app=${encodeURIComponent(id)}`
