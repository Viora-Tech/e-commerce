import { recordWebVitals, WebVitalBeaconSchema } from '@commerce/core'
import { isBotUserAgent } from '@commerce/core/marketing'
import { logger } from '@commerce/observability/logging'
import { headers } from 'next/headers'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

/** A beacon is a few dozen bytes; anything bigger is not ours. */
const MAX_BODY_BYTES = 2_000
/** Three readings a page; this only stops floods. */
const VITALS_IP_RULE = { limit: 90, windowMs: 60_000 }

/** Readings come from the store's own pages: a cross-site Origin is refused. */
function sameOrigin(request: Request, host: string | null): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Core Web Vitals from shoppers' browsers (`components/analytics/web-vitals-beacon.tsx`) for the
 * admin's Web performance strip. Anonymous by design (no cookies read or set, no visitor id or
 * address kept), so it does not wait for analytics consent. The proxy sets `x-store-id`.
 */
export const POST = withEvlog(async (request: Request) => {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId || isBotUserAgent(h.get('user-agent')) || !sameOrigin(request, h.get('host'))) {
    return new Response(null, { status: 204 })
  }
  if (!(await rateLimited('web-vitals:ip', clientIp(request.headers), VITALS_IP_RULE)).ok) {
    return new Response(null, { status: 204 })
  }
  const text = await request.text().catch(() => '')
  if (!text || text.length > MAX_BODY_BYTES) return new Response(null, { status: 204 })
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return new Response(null, { status: 204 })
  }
  const parsed = WebVitalBeaconSchema.safeParse(raw)
  if (!parsed.success) return new Response(null, { status: 204 })
  try {
    await inStore(storeId, (tx) => recordWebVitals(tx, storeId, parsed.data))
  } catch (err) {
    // A lost reading costs one sample of the report, never the page.
    logger.warn('could not record web vitals', { storeId, error: err })
  }
  return new Response(null, { status: 204 })
})
