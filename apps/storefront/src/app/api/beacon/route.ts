import { loadEnv } from '@commerce/config'
import { recordVisit, sharedRedis } from '@commerce/queue'
import { cookies, headers } from 'next/headers'
import { parseVisitorId, VISITOR_COOKIE } from '@/lib/visitor-cookie'

/**
 * Page-view beacon for the admin's live-visitor card. The proxy derives
 * `x-store-id` from the host and mints the visitor cookie, so nothing in the
 * body is trusted; a request without either is simply ignored.
 */
export async function POST() {
  const storeId = (await headers()).get('x-store-id')
  const visitorId = parseVisitorId((await cookies()).get(VISITOR_COOKIE)?.value)
  if (storeId && visitorId) {
    await recordVisit(sharedRedis(loadEnv(process.env).REDIS_URL), storeId, visitorId)
  }
  return new Response(null, { status: 204 })
}
