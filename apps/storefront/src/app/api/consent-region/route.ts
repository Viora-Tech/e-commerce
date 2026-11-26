import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { requestConsent } from '@/lib/consent-cookie'
import { withEvlog } from '@/lib/request-log'
import { parseVisitorId, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from '@/lib/visitor-cookie'

const NO_STORE = { 'cache-control': 'private, no-store' }

/**
 * Whether the banner asks this visitor (`ask`) or tracking runs from the first page (`open`),
 * for a page drawn without the region because a shared cache may keep it (`x-consent-pending`,
 * `lib/consent-cookie.ts`). Never cached. For an `open` visitor with analytics allowed it also
 * mints the anonymous visitor id the proxy would have set on an uncached page, so the visit
 * beacon that follows reports one visitor.
 */
export const GET = withEvlog(async (request: Request) => {
  const storeId = request.headers.get('x-store-id')
  if (!storeId) return NextResponse.json({ region: 'ask' }, { headers: NO_STORE })
  const { region, consent } = await requestConsent(storeId)
  const answer = NextResponse.json({ region }, { headers: NO_STORE })
  const existing = (await cookies()).get(VISITOR_COOKIE)?.value
  if (region === 'open' && consent?.analytics && !parseVisitorId(existing)) {
    answer.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(request.url).protocol === 'https:',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }
  return answer
})
