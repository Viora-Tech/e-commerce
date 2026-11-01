import 'server-only'

import {
  type DiscoveryEventInput,
  productIdForHandle,
  recordDiscoveryAdd,
  recordDiscoveryCheckout,
  recordDiscoveryEvent,
} from '@commerce/core'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { logger } from '@commerce/observability/logging'
import { cookies } from 'next/headers'
import { analyticsAllowed } from './consent-cookie'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'
import { parseVisitorId, VISITOR_COOKIE } from './visitor-cookie'

/** A busy shopper clicks a lot, but not this much; past it the events are dropped. */
const DISCOVERY_IP_RULE = { limit: 120, windowMs: 60_000 }

type Parsed =
  | { kind: 'search'; query: string; results: number }
  | { kind: 'impression'; source: 'related' | 'complementary'; handle: string }
  | { kind: 'click'; source: 'search' | 'related' | 'complementary'; handle: string; query: string }

const ROWS = new Set(['related', 'complementary'])
const SOURCES = new Set(['search', 'related', 'complementary'])

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** The beacon body's `discovery` field, checked; null when it is not one of ours. */
export function parseDiscoveryEvent(raw: unknown): Parsed | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const handle = str(e.handle, 255).trim().toLowerCase()
  if (e.kind === 'search') {
    const query = str(e.query, 500)
    const results = typeof e.results === 'number' && Number.isFinite(e.results) ? e.results : 0
    return query.trim() ? { kind: 'search', query, results } : null
  }
  if (e.kind === 'impression' && ROWS.has(String(e.source)) && handle) {
    return { kind: 'impression', source: e.source as 'related' | 'complementary', handle }
  }
  if (e.kind === 'click' && SOURCES.has(String(e.source)) && handle) {
    return {
      kind: 'click',
      source: e.source as 'search' | 'related' | 'complementary',
      handle,
      query: str(e.query, 500),
    }
  }
  return null
}

/**
 * Writes one Search & discovery event from the beacon (already past the consent check). The
 * product's handle becomes its id; an unknown handle writes nothing. A failure is logged and
 * dropped: an event never costs the shopper anything.
 */
export async function recordBeaconDiscovery(
  request: Request,
  storeId: string,
  visitorId: string,
  event: Parsed,
): Promise<void> {
  const limit = await rateLimited('discovery:ip', clientIp(request.headers), DISCOVERY_IP_RULE)
  if (!limit.ok) return
  try {
    await inStore(storeId, async (tx) => {
      if (event.kind === 'search') {
        await recordDiscoveryEvent(tx, storeId, visitorId, event)
        return
      }
      const productId = await productIdForHandle(tx, event.handle)
      if (!productId) return
      const input: DiscoveryEventInput =
        event.kind === 'impression'
          ? { kind: 'impression', source: event.source, productId }
          : { kind: 'click', source: event.source, productId, query: event.query }
      await recordDiscoveryEvent(tx, storeId, visitorId, input)
    })
  } catch (err) {
    logger.warn('could not record a search & discovery event', { storeId, error: err })
  }
}

/**
 * The shopper behind this request, when Search & discovery may count them: a yes to analytics
 * and our anonymous browser id. Null otherwise.
 */
export async function discoveryVisitor(): Promise<string | null> {
  const jar = await cookies()
  if (!analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) return null
  return parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
}

/** An order placed by a session that added from search or a recommendation: the funnel's last step. */
export async function recordDiscoveryOrder(storeId: string, visitorId: string): Promise<void> {
  try {
    await inStore(storeId, (tx) => recordDiscoveryCheckout(tx, storeId, visitorId))
  } catch (err) {
    logger.warn('could not record a search & discovery order', { storeId, error: err })
  }
}

/** An add to cart by a session that clicked a search result or recommendation in the last 30 minutes. */
export async function recordDiscoveryCartAdd(
  storeId: string,
  visitorId: string,
  variantId: string,
): Promise<void> {
  try {
    await inStore(storeId, (tx) => recordDiscoveryAdd(tx, storeId, visitorId, variantId))
  } catch (err) {
    logger.warn('could not record a search & discovery add', { storeId, error: err })
  }
}
