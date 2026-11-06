/**
 * The storefront's pixel events (Pixels app). Blocks and pages only fire a DOM event
 * (`commerce:track`, see `@commerce/blocks` `trackCommerce`); the listener, mounted by the consent
 * manager only after a yes to marketing, sends each one twice with one event id: to every
 * browser pixel that has the event on (`fbq('trackSingle', …, { eventID })`) and to our own
 * `/api/px`, which queues the server copy. Meta counts the pair once.
 */
import { COMMERCE_TRACK_EVENT, type CommerceTrackDetail } from '@commerce/blocks'
import { addToCartEventId, isPixelEventName, type PixelEventName } from '@commerce/core/pixels'
import { trackingAllowedOn } from '@/lib/tracking-paths'

export type BrowserPixel = { id: string; events: PixelEventName[]; browserPurchase: boolean }

const PX_PATH = '/api/px'

type Fbq = (...args: unknown[]) => void

/** Calls made before fbevents.js loads (it loads lazily) wait here for a few seconds. */
const pending: unknown[][] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

function fbq(...args: unknown[]): void {
  const f = (window as unknown as { fbq?: Fbq }).fbq
  if (f) {
    f(...args)
    return
  }
  pending.push(args)
  if (flushTimer) return
  let tries = 0
  flushTimer = setInterval(() => {
    const ready = (window as unknown as { fbq?: Fbq }).fbq
    tries += 1
    if (ready) for (const a of pending.splice(0)) ready(...a)
    if (ready || tries > 60) {
      if (flushTimer) clearInterval(flushTimer)
      flushTimer = null
      pending.length = 0
    }
  }, 500)
}

const ADD_COUNT_KEY = 'wc_px_atc'

/** The n-th add of this variant in this tab, so two adds are two AddToCart events. */
function nextAddCount(variantId: string): number {
  try {
    const raw = sessionStorage.getItem(ADD_COUNT_KEY)
    const counts = (raw ? JSON.parse(raw) : {}) as Record<string, number>
    const n = ((counts[variantId] ?? 0) % 9999) + 1
    counts[variantId] = n
    sessionStorage.setItem(ADD_COUNT_KEY, JSON.stringify(counts))
    return n
  } catch {
    return Math.floor(Math.random() * 9999) + 1
  }
}

/** The event id both copies carry. */
export function eventIdFor(detail: CommerceTrackDetail): string {
  if (detail.eventId) return detail.eventId
  if (detail.name === 'AddToCart' && detail.variantId) {
    return addToCartEventId(detail.variantId, nextAddCount(detail.variantId))
  }
  return crypto.randomUUID()
}

const rupees = (paise: number) => Math.round(paise) / 100

/** Meta's custom data for the browser copy. */
export function fbqData(detail: CommerceTrackDetail): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (typeof detail.valuePaise === 'number') {
    data.value = rupees(detail.valuePaise)
    data.currency = 'INR'
  }
  const ids = detail.contentIds ?? (detail.variantId ? [detail.variantId] : [])
  if (ids.length) {
    data.content_ids = ids
    data.content_type = 'product'
  }
  if (typeof detail.numItems === 'number') data.num_items = detail.numItems
  return data
}

/** Meta's advanced matching fields: lower-case email, phone as digits with the country code. */
export function matchData(match: CommerceTrackDetail['match']): Record<string, string> | null {
  const email = match?.email?.trim().toLowerCase()
  const digits = match?.phone?.replace(/[^0-9]/g, '') ?? ''
  const phone = digits.length === 10 ? `91${digits}` : digits
  const data = {
    ...(email?.includes('@') ? { em: email } : {}),
    ...(phone.length >= 11 ? { ph: phone } : {}),
  }
  return Object.keys(data).length ? data : null
}

function beacon(body: Record<string, unknown>): void {
  const json = JSON.stringify(body)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(PX_PATH, new Blob([json], { type: 'application/json' }))
    return
  }
  void fetch(PX_PATH, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: json,
  })
}

/** Send one event to the browser pixels and to `/api/px`. */
export function sendPixelEvent(pixels: BrowserPixel[], detail: CommerceTrackDetail): void {
  detail.handled = true
  if (!isPixelEventName(detail.name)) return
  // Sign-in pages carry single-use tokens in the URL: nothing leaves them.
  if (!trackingAllowedOn(window.location.pathname)) return
  const name = detail.name
  const eventId = eventIdFor(detail)
  const data = fbqData(detail)
  const match = matchData(detail.match)
  for (const p of pixels) {
    if (!p.events.includes(name)) continue
    // A paid or delivered server Purchase can arrive after Meta's 48 h dedup window.
    if (name === 'Purchase' && !p.browserPurchase) continue
    // fbevents.js hashes these in the browser before anything leaves it.
    if (match) fbq('init', p.id, match)
    fbq('trackSingle', p.id, name, data, { eventID: eventId })
  }
  beacon({
    name,
    eventId,
    url: window.location.href,
    productId: detail.productId,
    variantId: detail.variantId,
    ...(name === 'AddToCart' && typeof detail.numItems === 'number'
      ? { quantity: detail.numItems }
      : {}),
  })
}

/** Start listening for `commerce:track`; returns the cleanup. */
export function listenForPixelEvents(pixels: BrowserPixel[]): () => void {
  const onTrack = (e: Event) => {
    const detail = (e as CustomEvent<CommerceTrackDetail>).detail
    if (detail) sendPixelEvent(pixels, detail)
  }
  window.addEventListener(COMMERCE_TRACK_EVENT, onTrack)
  return () => window.removeEventListener(COMMERCE_TRACK_EVENT, onTrack)
}
