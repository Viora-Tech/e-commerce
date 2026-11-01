/** SOURCE OF TRUTH: Home smart cards — WHAT: the rules that turn a store's own numbers (product page sessions vs add to carts, collections still live after their season, repeat buyers, best sellers running out, old unfulfilled orders, abandoned checkouts, products selling much faster than last month) into a short ranked list of cards, each with one action / WHY: the owner asked for Sidekick-style suggestions built from the store's data, not a canned list (#101) */

/*
 * Pure: no database and no clock of its own. The worker and the API read the facts
 * (`./facts.ts`) and store the result; the admin imports the card types through
 * `@commerce/core/home-cards` and renders the words from its own copy, so cards hold numbers
 * and names only, never sentences.
 */

/** How many cards Home shows at most, best first. */
export const HOME_CARD_LIMIT = 6

/** A product page needs this many landing sessions before its add-to-cart rate means anything. */
export const MIN_PAGE_SESSIONS = 100
/** Below this share of sessions adding to cart (1%), the page is not selling. */
export const WEAK_ADD_TO_CART_RATE = 0.01
/** Repeat buyers worth a segment of their own. */
export const MIN_REPEAT_BUYERS = 10
/** Units sold in 30 days that make a product a best seller for the restock card. */
export const MIN_BESTSELLER_UNITS = 5
/** Orders waiting longer than this to be packed get a card. */
export const OLD_UNFULFILLED_DAYS = 3
/** Abandoned checkouts with a contact, in the last week, worth a reminder. */
export const MIN_ABANDONED_CARTS = 3
/** A product counts as trending once its sales at least double (+100%) on the month before. */
export const MIN_TREND_PERCENT = 100
/** Units this month a trending product needs, so one sale against none never "trends". */
export const MIN_TREND_UNITS = 3

export const HOME_CARD_KINDS = [
  'old_unfulfilled',
  'restock_bestseller',
  'weak_product_page',
  'stale_collection',
  'abandoned_checkouts',
  'product_trending',
  'repeat_buyers',
] as const
export type HomeCardKind = (typeof HOME_CARD_KINDS)[number]

type CardBase = {
  /** Stable across refreshes (kind plus the product or collection), so a dismissal sticks. */
  key: string
  /** Higher first. */
  priority: number
}

type ProductRef = { productId: string; title: string; imageUrl: string | null }

export type HomeCard = CardBase &
  (
    | ({ kind: 'weak_product_page'; sessions: number; addToCarts: number } & ProductRef)
    | {
        kind: 'stale_collection'
        collectionId: string
        title: string
        imageUrl: string | null
        /** `season`: a festival or season word out of its months; `year`: an old year in the name. */
        reason: 'season' | 'year'
      }
    | { kind: 'repeat_buyers'; customers: number }
    | ({
        kind: 'restock_bestseller'
        available: number
        unitsSold: number
        /** Days of stock left at the last 30 days' pace. */
        daysLeft: number
      } & ProductRef)
    | { kind: 'old_unfulfilled'; orders: number; oldestDays: number }
    | { kind: 'abandoned_checkouts'; carts: number; valuePaise: number }
    | ({ kind: 'product_trending'; percent: number; revenuePaise: number } & ProductRef)
  )

export type HomeCardFacts = {
  /** Landing sessions on each product page and carts that took it, over the last 30 days. */
  productPages: readonly (ProductRef & { sessions: number; addToCarts: number })[]
  /** Collections that are live on the storefront. */
  collections: readonly { id: string; title: string; imageUrl: string | null }[]
  /** Customers with two or more orders. */
  repeatBuyers: number
  /** A saved segment already picks out repeat buyers (orders ≥ 2). */
  hasRepeatSegment: boolean
  /** The 30 days' best sellers with what is left to sell. */
  bestSellers: readonly (ProductRef & { unitsSold: number; available: number | null })[]
  lowStockThreshold: number
  /** Open orders not yet packed, with how long the oldest has waited. */
  unfulfilled: { orders: number; oldestDays: number }
  /** Checkouts left with a contact in the last 7 days. */
  abandoned: { carts: number; valuePaise: number }
  /** Sales per product this 30 days and the 30 days before. */
  productSales: readonly (ProductRef & {
    units: number
    revenuePaise: number
    previousRevenuePaise: number
  })[]
}

/* Festivals and seasons, with the months (1–12) a collection named after them makes sense:
   the month of the day and the one before it. Moving festivals take both months they can fall
   in. Eid and Ramadan move through the year, so they are left out. */
const SEASONS: readonly { words: readonly string[]; months: readonly number[] }[] = [
  { words: ['raksha bandhan', 'rakshabandhan', 'rakhi'], months: [7, 8] },
  { words: ['independence day'], months: [7, 8] },
  { words: ['ganesh', 'ganpati', 'onam'], months: [8, 9] },
  { words: ['navratri', 'dussehra', 'durga puja', 'garba'], months: [9, 10] },
  { words: ['karwa chauth'], months: [9, 10] },
  { words: ['diwali', 'deepavali', 'dhanteras', 'bhai dooj'], months: [9, 10, 11] },
  { words: ['black friday', 'cyber monday'], months: [11] },
  { words: ['christmas', 'xmas'], months: [11, 12] },
  { words: ['new year'], months: [12, 1] },
  { words: ['lohri', 'pongal', 'sankranti', 'republic day'], months: [12, 1] },
  { words: ['valentine'], months: [1, 2] },
  { words: ['holi'], months: [2, 3] },
  { words: ["mother's day", 'mothers day'], months: [4, 5] },
  { words: ["father's day", 'fathers day'], months: [5, 6] },
  { words: ['back to school'], months: [5, 6, 7] },
  { words: ['summer'], months: [3, 4, 5, 6] },
  { words: ['monsoon'], months: [6, 7, 8, 9] },
  { words: ['winter'], months: [10, 11, 12, 1, 2] },
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SEASON_PATTERNS = SEASONS.map((s) => ({
  months: s.months,
  re: new RegExp(`(^|[^a-z])(${s.words.map(escapeRe).join('|')})([^a-z]|$)`, 'i'),
}))

/**
 * Why a live collection looks out of date in `month` (1–12) of `year`: a festival or season
 * word whose months have passed, or a year before this one in its name. Null when it is fine.
 */
export function staleCollectionReason(
  title: string,
  month: number,
  year: number,
): 'season' | 'year' | null {
  const years = [...title.matchAll(/(?:^|\D)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]))
  if (years.length > 0 && Math.max(...years) < year) return 'year'
  const seasons = SEASON_PATTERNS.filter((s) => s.re.test(title))
  if (seasons.length > 0 && !seasons.some((s) => s.months.includes(month))) return 'season'
  return null
}

const percentUp = (now: number, before: number) => Math.round(((now - before) / before) * 100)

/**
 * The cards for one store, best first and at most `HOME_CARD_LIMIT`. `month` and `year` are
 * the store's local calendar (IST), for the season rule.
 */
export function buildHomeCards(
  facts: HomeCardFacts,
  at: { month: number; year: number },
): HomeCard[] {
  const cards: HomeCard[] = []

  if (facts.unfulfilled.orders > 0 && facts.unfulfilled.oldestDays > OLD_UNFULFILLED_DAYS) {
    cards.push({
      key: 'old_unfulfilled',
      priority: 100,
      kind: 'old_unfulfilled',
      ...facts.unfulfilled,
    })
  }

  const restock = facts.bestSellers
    .filter(
      (p) =>
        p.available !== null &&
        p.unitsSold >= MIN_BESTSELLER_UNITS &&
        p.available <= facts.lowStockThreshold,
    )
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 2)
  for (const p of restock) {
    const available = Math.max(p.available ?? 0, 0)
    cards.push({
      key: `restock_bestseller:${p.productId}`,
      priority: 90,
      kind: 'restock_bestseller',
      productId: p.productId,
      title: p.title,
      imageUrl: p.imageUrl,
      available,
      unitsSold: p.unitsSold,
      daysLeft: Math.floor(available / (p.unitsSold / 30)),
    })
  }

  const weak = facts.productPages
    .filter(
      (p) => p.sessions >= MIN_PAGE_SESSIONS && p.addToCarts / p.sessions < WEAK_ADD_TO_CART_RATE,
    )
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 2)
  for (const p of weak) {
    cards.push({
      key: `weak_product_page:${p.productId}`,
      priority: 80,
      kind: 'weak_product_page',
      ...p,
    })
  }

  for (const c of facts.collections) {
    const reason = staleCollectionReason(c.title, at.month, at.year)
    if (!reason) continue
    cards.push({
      key: `stale_collection:${c.id}`,
      priority: 70,
      kind: 'stale_collection',
      collectionId: c.id,
      title: c.title,
      imageUrl: c.imageUrl,
      reason,
    })
  }

  if (facts.abandoned.carts >= MIN_ABANDONED_CARTS) {
    cards.push({
      key: 'abandoned_checkouts',
      priority: 60,
      kind: 'abandoned_checkouts',
      ...facts.abandoned,
    })
  }

  const trending = facts.productSales
    .filter(
      (p) =>
        p.previousRevenuePaise > 0 &&
        p.units >= MIN_TREND_UNITS &&
        percentUp(p.revenuePaise, p.previousRevenuePaise) >= MIN_TREND_PERCENT,
    )
    .sort(
      (a, b) => b.revenuePaise - b.previousRevenuePaise - (a.revenuePaise - a.previousRevenuePaise),
    )[0]
  if (trending) {
    cards.push({
      key: `product_trending:${trending.productId}`,
      priority: 50,
      kind: 'product_trending',
      productId: trending.productId,
      title: trending.title,
      imageUrl: trending.imageUrl,
      percent: percentUp(trending.revenuePaise, trending.previousRevenuePaise),
      revenuePaise: trending.revenuePaise,
    })
  }

  if (facts.repeatBuyers >= MIN_REPEAT_BUYERS && !facts.hasRepeatSegment) {
    cards.push({
      key: 'repeat_buyers',
      priority: 40,
      kind: 'repeat_buyers',
      customers: facts.repeatBuyers,
    })
  }

  return cards.sort((a, b) => b.priority - a.priority).slice(0, HOME_CARD_LIMIT)
}

/** Read back a stored card, dropping rows from an older shape rather than crashing Home. */
export function parseHomeCard(value: unknown): HomeCard | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { kind?: unknown; key?: unknown }
  if (typeof v.key !== 'string') return null
  return HOME_CARD_KINDS.includes(v.kind as HomeCardKind) ? (value as HomeCard) : null
}
