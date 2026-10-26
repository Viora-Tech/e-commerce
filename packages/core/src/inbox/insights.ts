/** SOURCE OF TRUTH: inbox shopper insights — WHAT: the pure pieces of what the admin shows and the AI reads about a chat: the pages the shopper wrote from, the product page they are on, where they are, the thread as the AI sees it, the store's shipping rates as lines / WHY: the customer panel and the staff AI help read the same facts the same way, and these rules are unit-tested without a database. */
import type { InboxAssistInput, InboxAssistShippingRate } from '@commerce/ai'

/** Most pages the panel lists, newest first. */
const INSIGHT_PAGES_MAX = 5
const PAGE_MAX = 200

/**
 * The storefront path a shopper message came from, kept only when it is a plain same-site path
 * (no scheme, no `//host`), without the query or hash (they can carry tokens).
 */
export function cleanPagePath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const path = raw.trim().split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/') || path.startsWith('//') || /\s/.test(path)) return null
  return path.slice(0, PAGE_MAX)
}

/** The page a stored message carries (`payload.page`), if any. */
export function pageOf(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  return cleanPagePath((payload as Record<string, unknown>).page as string | undefined)
}

/**
 * Pages the shopper wrote from, newest first and each once: every message's page, then the
 * page the chat started on.
 */
export function pagesViewed(
  startedUrl: string | null,
  newestFirst: { payload: unknown }[],
): string[] {
  const out: string[] = []
  for (const page of [...newestFirst.map((m) => pageOf(m.payload)), cleanPagePath(startedUrl)]) {
    if (page && !out.includes(page)) out.push(page)
    if (out.length === INSIGHT_PAGES_MAX) break
  }
  return out
}

/** The product handle of a storefront product page (`/products/blue-kurta`), or null. */
export function productHandleOf(path: string | null): string | null {
  const match = path ? /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/products\/([^/]+)\/?$/i.exec(path) : null
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1]).toLowerCase()
  } catch {
    return null
  }
}

export type InsightLocation = { city: string; stateCode: string; pincode: string | null }

/** Where the shopper is: their saved address (the latest order's), when they have one. */
export function locationOf(
  address: { city?: string | null; stateCode?: string | null; pincode?: string | null } | null,
): InsightLocation | null {
  const city = address?.city?.trim()
  const stateCode = address?.stateCode?.trim()
  if (!city || !stateCode) return null
  return { city, stateCode, pincode: address?.pincode?.trim() || null }
}

type ThreadRow = { sender: string; kind: string; body: string }

/** The thread as the AI reads it, oldest first: text from shopper, team and AI, and team notes. */
export function assistThread(oldestFirst: ThreadRow[]): InboxAssistInput['thread'] {
  return oldestFirst.flatMap((m): InboxAssistInput['thread'] => {
    if (!m.body.trim() || m.sender === 'system') return []
    if (m.kind === 'note') return [{ from: 'note' as const, text: m.body }]
    if (m.kind !== 'text') return []
    return [
      { from: m.sender === 'shopper' ? ('shopper' as const) : ('store' as const), text: m.body },
    ]
  })
}

/** True when the newest message anyone can see is the shopper's: a reply is due. */
export function awaitsReply(oldestFirst: ThreadRow[]): boolean {
  const visible = oldestFirst.filter((m) => m.sender !== 'system' && m.kind !== 'note')
  return visible.at(-1)?.sender === 'shopper'
}

/** The shopper's newest few messages, joined: what the catalogue search reads. */
export function latestQuestion(oldestFirst: ThreadRow[], take = 2): string {
  const asked: string[] = []
  for (let i = oldestFirst.length - 1; i >= 0 && asked.length < take; i--) {
    const m = oldestFirst[i]
    if (!m || m.sender === 'system' || m.kind === 'note') continue
    if (m.sender !== 'shopper') break
    if (m.kind === 'text' && m.body.trim()) asked.unshift(m.body)
  }
  return asked.join(' ')
}

/** "3 to 5 days" (or "3 days") from a rate's promise; null without one. */
function transitDays(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null
  const one = min ?? max
  if (min === null || max === null || min === max) return `${one} ${one === 1 ? 'day' : 'days'}`
  return `${min} to ${max} days`
}

type ZoneRates = {
  name: string
  rates: {
    name: string
    pricePaise: number
    freeAbovePaise: number | null
    minTransitDays: number | null
    maxTransitDays: number | null
  }[]
}

/** Each zone's rates as the AI reads them, at most `max` lines. */
export function shippingRateLines(zones: ZoneRates[], max = 12): InboxAssistShippingRate[] {
  return zones
    .flatMap((z) =>
      z.rates.map((r) => ({
        zone: z.name,
        name: r.name,
        pricePaise: r.pricePaise,
        freeAbovePaise: r.freeAbovePaise,
        days: transitDays(r.minTransitDays, r.maxTransitDays),
      })),
    )
    .slice(0, max)
}
