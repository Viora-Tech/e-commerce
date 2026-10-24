/** SOURCE OF TRUTH: Pixels storefront collector — WHAT: what `/api/px` does with one browser event: refuses without marketing consent on the current banner, reads or mints the first-party _fbp/_fbc, stamps the cart's tracking, and plans one send job per server pixel with the event on / WHY: the server copy of a browser event must carry the same event id and the shopper's consent, and the collector must never block a page */
import { cart, type PixelTracking, pixelConnection, type StoreTx, store } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { parseAppsSettings } from '../apps/settings'
import { parseCustomerPrivacySettings } from '../privacy/client'
import {
  browserSendsPurchase,
  fbcFromClick,
  fbclidOf,
  isPixelEventName,
  isValidEventId,
  isValidFbc,
  isValidFbp,
  mintFbp,
  type PixelEventName,
} from './client'
import { PIXELS_APP_ID, type PixelStorefrontSendJob } from './jobs'

/** Largest body the collector reads. */
export const PIXEL_BEACON_MAX_BYTES = 4096

export type PixelBeacon = {
  name: PixelEventName
  eventId: string
  url: string | null
  productId: string | null
  variantId: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuidOrNull = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null)

/** The browser's body, or null when it is not one of our five events in our id shapes. */
export function parsePixelBeacon(raw: unknown): PixelBeacon | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  if (!isPixelEventName(b.name)) return null
  if (typeof b.eventId !== 'string' || !isValidEventId(b.name, b.eventId)) return null
  let url: string | null = null
  if (typeof b.url === 'string' && b.url.length <= 2000) {
    try {
      const u = new URL(b.url)
      if (u.protocol === 'https:' || u.protocol === 'http:') url = u.toString()
    } catch {
      url = null
    }
  }
  return {
    name: b.name,
    eventId: b.eventId,
    url,
    productId: uuidOrNull(b.productId),
    variantId: uuidOrNull(b.variantId),
  }
}

/**
 * The _fbp / _fbc to keep for this browser: existing valid ones are kept, a missing _fbp is
 * minted, and an ad click (`fbclid` in the page URL) makes a new _fbc unless it is the same click.
 */
export function firstPartyIds(
  existing: { fbp?: string | undefined; fbc?: string | undefined },
  url: string | null,
  now: Date,
  random: number,
): { fbp: string; fbc: string | null; fbclid: string | null; set: ('fbp' | 'fbc')[] } {
  const set: ('fbp' | 'fbc')[] = []
  let fbp = isValidFbp(existing.fbp) ? existing.fbp : null
  if (!fbp) {
    fbp = mintFbp(now, random)
    set.push('fbp')
  }
  let fbc = isValidFbc(existing.fbc) ? existing.fbc : null
  let clicked: string | null = null
  try {
    clicked = url ? new URL(url).searchParams.get('fbclid') : null
  } catch {
    clicked = null
  }
  if (clicked && (!fbc || fbclidOf(fbc) !== clicked)) {
    const next = fbcFromClick(clicked, now)
    if (next) {
      fbc = next
      set.push('fbc')
    }
  }
  return { fbp, fbc, fbclid: fbc ? fbclidOf(fbc) : null, set }
}

export type CollectInput = {
  storeId: string
  beacon: PixelBeacon
  cartId: string | null
  visitorId: string | null
  tracking: PixelTracking
  now: Date
}

/**
 * Stamp the cart (when there is one) and plan the server copies. Purchase is never sent from
 * here: the order's own job sends it, at the moment each pixel chose.
 */
export async function collectPixelEvent(
  tx: StoreTx,
  input: CollectInput,
): Promise<PixelStorefrontSendJob[]> {
  if (input.cartId) {
    await tx
      .update(cart)
      .set({
        tracking: sql`coalesce(${cart.tracking}, '{}'::jsonb) || ${JSON.stringify(input.tracking)}::jsonb`,
      })
      .where(and(eq(cart.id, input.cartId), eq(cart.status, 'open')))
  }
  if (input.beacon.name === 'Purchase') return []
  const pixels = await tx
    .select({ id: pixelConnection.id, events: pixelConnection.events })
    .from(pixelConnection)
    .where(and(eq(pixelConnection.status, 'active'), sql`${pixelConnection.tokenEnc} is not null`))
  const t = input.tracking
  return pixels
    .filter((p) => p.events.includes(input.beacon.name))
    .map((p) => ({
      storeId: input.storeId,
      connectionId: p.id,
      origin: 'storefront' as const,
      eventName: input.beacon.name,
      eventId: input.beacon.eventId,
      at: input.now.toISOString(),
      ...(input.beacon.url ? { url: input.beacon.url } : {}),
      ...(t.fbp ? { fbp: t.fbp } : {}),
      ...(t.fbc ? { fbc: t.fbc } : {}),
      ...(t.ip ? { ip: t.ip } : {}),
      ...(t.ua ? { ua: t.ua } : {}),
      ...(input.visitorId ? { visitorId: input.visitorId } : {}),
      ...(input.cartId ? { cartId: input.cartId } : {}),
      ...(input.beacon.productId ? { productId: input.beacon.productId } : {}),
      ...(input.beacon.variantId ? { variantId: input.beacon.variantId } : {}),
    }))
}

/** What the collector needs of the store: is Pixels installed, and the banner version now shown. */
export async function collectorStore(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; bannerVersion: number }> {
  const [s] = await tx
    .select({ apps: store.apps, preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return {
    installed: parseAppsSettings(s?.apps).installed.includes(PIXELS_APP_ID),
    bannerVersion: parseCustomerPrivacySettings(s?.preferences).bannerVersion,
  }
}

/** Pixel ids the browser initialises: every pixel that is not paused, with its events. */
export async function browserPixels(tx: StoreTx) {
  const rows = await tx
    .select({
      pixelId: pixelConnection.pixelId,
      events: pixelConnection.events,
      purchaseTrigger: pixelConnection.purchaseTrigger,
      status: pixelConnection.status,
    })
    .from(pixelConnection)
    .orderBy(pixelConnection.createdAt)
  return rows
    .filter((r) => r.status !== 'paused')
    .map((r) => ({
      id: r.pixelId,
      events: r.events as PixelEventName[],
      browserPurchase: browserSendsPurchase(r.purchaseTrigger),
    }))
}
