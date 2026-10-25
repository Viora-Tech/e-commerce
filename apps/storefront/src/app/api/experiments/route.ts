import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { logger } from '@commerce/observability/logging'
import { recordExposures, recordPurchase } from '@commerce/plugin-growthbook/server'
import { cookies, headers } from 'next/headers'
import { analyticsAllowed } from '@/lib/consent-cookie'
import { assignVisitor, experimentsEnabled } from '@/lib/experiments'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'
import { parseVisitorId, VISITOR_COOKIE } from '@/lib/visitor-cookie'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Most experiments one page can report. */
const MAX_SEEN = 20

type Body = { seen: string[]; order: string | null }

async function readBody(request: Request): Promise<Body> {
  try {
    const body = (await request.json()) as { seen?: unknown; order?: unknown }
    const seen = Array.isArray(body.seen)
      ? body.seen.filter((k): k is string => typeof k === 'string' && k.length <= 100)
      : []
    const order = typeof body.order === 'string' && UUID.test(body.order) ? body.order : null
    return { seen: seen.slice(0, MAX_SEEN), order }
  } catch {
    return { seen: [], order: null }
  }
}

/**
 * GrowthBook app events from the page (`components/analytics/experiment-beacon.tsx`): the
 * experiments a page was drawn with ("experiment viewed"), or the order its thank-you page
 * shows (a purchase). The variation is worked out again here from the visitor id, never taken
 * from the body, and nothing is written without a yes to analytics.
 */
export const POST = withEvlog(async (request: Request) => {
  const storeId = (await headers()).get('x-store-id')
  const jar = await cookies()
  const visitorId = parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
  if (!storeId || !visitorId || !analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) {
    return new Response(null, { status: 204 })
  }
  const { seen, order: placed } = await readBody(request)
  const order = placed && (await experimentsEnabled(storeId)) ? placed : null
  const assignments = seen.length ? await assignVisitor(storeId, visitorId) : {}
  const exposed = seen.flatMap((key) => {
    const a = Object.hasOwn(assignments, key) ? assignments[key] : undefined
    return a ? [a] : []
  })
  if (exposed.length === 0 && !order) return new Response(null, { status: 204 })
  try {
    await inStore(storeId, async (tx) => {
      await recordExposures(tx, storeId, visitorId, exposed)
      if (order) await recordPurchase(tx, storeId, visitorId, order)
    })
  } catch (err) {
    // A lost event costs one row of an experiment's numbers, never the page.
    logger.warn('could not record experiment events', { storeId, error: err })
  }
  return new Response(null, { status: 204 })
})
