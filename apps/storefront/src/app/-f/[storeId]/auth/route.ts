import { settingsSecret } from '@commerce/config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { type NextRequest, NextResponse } from 'next/server'
import { openPortalHandoff, PORTAL_HANDOFF_TTL_MS } from '@/lib/portal-handoff'
import { PORTAL_BASE_HEADER } from '@/lib/portal-routing'
import { rateLimited } from '@/lib/rate-limit'
import { signInCustomer } from '@/lib/shopper-login'

type Params = { params: Promise<{ storeId: string }> }

/**
 * `affiliate.<domain>/auth?t=`: the hand-off from the store's domain (`/affiliate/continue`).
 * A token for this store, unexpired and not used before, starts a session on this host; anything
 * else lands on the portal's sign-in page.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId } = await params
  const h = await headers()
  // Only on the portal's own host: a store domain keeps the session it already has.
  if (h.get('x-store-id') !== storeId || h.get(PORTAL_BASE_HEADER) !== '') {
    return new NextResponse('Not found', { status: 404 })
  }
  const opened = openPortalHandoff(request.nextUrl.searchParams.get('t'), storeId, settingsSecret())
  if (!opened) redirect('/sign-in')
  // Single use: the nonce is spent the first time (a limit of one per token lifetime).
  const fresh = await rateLimited('affiliate-portal-handoff', `${storeId}:${opened.nonce}`, {
    limit: 1,
    windowMs: PORTAL_HANDOFF_TTL_MS + 60_000,
  })
  if (!fresh.ok) redirect('/sign-in')
  await signInCustomer(storeId, opened.customerId, true)
  redirect('/')
}
