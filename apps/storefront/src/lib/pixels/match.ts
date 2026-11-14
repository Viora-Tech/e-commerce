/**
 * Manual advanced matching for the Pixels app's browser pixels. Only ever runs inside the
 * listener the consent manager mounts after a yes to marketing (`PixelEvents`): without that yes
 * nothing here is called and no pixel is initialised.
 *
 * Every value handed to `fbq('init', pixelId, data)` is a SHA-256 hex digest, normalised by the
 * same rules as the server Conversions API (`@commerce/core/pixels` `normaliseCustomerFacts`), so
 * the browser and server copies of an event match the same person and no readable email or
 * phone is ever given to fbevents.js. Two sources:
 * - `/api/px/me`, hashed on the server: the signed-in customer and the cart's checkout contact;
 * - checkout, as the shopper types (`reportShopperFacts`), hashed here with Web Crypto.
 */
import {
  browserMatchData,
  type CustomerFacts,
  type MatchValues,
  normaliseCustomerFacts,
} from '@commerce/core/pixels'

const ME_PATH = '/api/px/me'

/** How long the pixel waits for `/api/px/me` before starting without matching. */
export const MATCH_WAIT_MS = 1500

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Normalise and hash what the shopper typed; null when nothing usable (or no Web Crypto). */
export async function hashShopperFacts(facts: CustomerFacts): Promise<MatchValues | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(normaliseCustomerFacts(facts))) {
    out[key] = await sha256Hex(value)
  }
  return browserMatchData(out)
}

/** The server's hashed match for this shopper, or null (no consent, nothing known, too slow). */
export async function loadServerMatch(wait = MATCH_WAIT_MS): Promise<MatchValues | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), wait)
  try {
    const res = await fetch(ME_PATH, { credentials: 'same-origin', signal: controller.signal })
    if (!res.ok || res.status === 204) return null
    const body = (await res.json()) as { match?: unknown }
    return browserMatchData(body.match)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Later facts win key by key; a key the later source does not know keeps the earlier value. */
export function mergeMatch(base: MatchValues | null, next: MatchValues | null): MatchValues | null {
  if (!base) return next
  if (!next) return base
  return { ...base, ...next }
}

type Applier = (facts: CustomerFacts) => void

let applier: Applier | null = null
let latest: CustomerFacts | null = null

/**
 * Checkout reports what the shopper has typed. Kept in this module (never on `window`) and
 * used only once the marketing listener is listening; without it, nothing happens.
 */
export function reportShopperFacts(facts: CustomerFacts): void {
  latest = facts
  applier?.(facts)
}

/** The listener's side: receives the latest facts now and every later report. */
export function listenForShopperFacts(apply: Applier): () => void {
  applier = apply
  if (latest) apply(latest)
  return () => {
    if (applier === apply) applier = null
  }
}

/** For tests. */
export function resetShopperFacts(): void {
  applier = null
  latest = null
}
