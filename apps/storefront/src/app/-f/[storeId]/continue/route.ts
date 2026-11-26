import { settingsSecret } from '@commerce/config'
import { resolveHost } from '@commerce/db'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { currentCustomer } from '@/lib/customer-session'
import { db } from '@/lib/db'
import { signPortalHandoff } from '@/lib/portal-handoff'
import {
  PORTAL_BASE_HEADER,
  PORTAL_CONTINUE_PATH,
  PORTAL_PATH,
  portalHostFor,
  portalOriginFor,
} from '@/lib/portal-routing'
import { requestOrigin } from '@/lib/shopper-login'

type Params = { params: Promise<{ storeId: string }> }

/**
 * `/affiliate/continue` on the store's domain: carries the shopper signed in here over to the
 * portal's own host (`affiliate.<domain>/auth?t=`), which starts its own session. Signed out:
 * the store's sign-in first, then back here. No live portal host: the portal on this domain.
 */
export async function GET(_request: Request, { params }: Params) {
  const { storeId } = await params
  const h = await headers()
  // Only on a store domain (`/affiliate/...`), never on the portal host itself.
  if (h.get('x-store-id') !== storeId || h.get(PORTAL_BASE_HEADER) !== PORTAL_PATH) {
    return new NextResponse('Not found', { status: 404 })
  }
  const me = await currentCustomer(storeId)
  if (!me) redirect(`/account/login?return_to=${encodeURIComponent(PORTAL_CONTINUE_PATH)}`)
  const { origin, hostname } = await requestOrigin()
  const live = await resolveHost(db(), portalHostFor(hostname)).catch(() => null)
  if (live?.storeId !== storeId) redirect(PORTAL_PATH)
  const token = signPortalHandoff(storeId, me.id, settingsSecret())
  const to = new URL('/auth', portalOriginFor(origin))
  to.searchParams.set('t', token)
  const response = NextResponse.redirect(to, 303)
  response.headers.set('cache-control', 'private, no-store')
  return response
}
