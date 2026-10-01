import { settingsSecret } from '@commerce/config'
import {
  HANDOFF_RETURN_PATH,
  randomToken,
  START_TTL_MS,
  type StartPayload,
  safeNextPath,
  sha256Hex,
  signToken,
} from '@commerce/core'
import { SOCIAL_PROVIDERS, type SocialProvider } from '@commerce/core/customer-accounts'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { accountsOrigin } from '@/lib/accounts-host'
import { currentCustomer } from '@/lib/customer-session'
import {
  cookieSecure,
  LOGIN_BROWSER_COOKIE,
  requestOrigin,
  storeLoginApp,
} from '@/lib/shopper-login'

type Params = { params: Promise<{ storeId: string; provider: string }> }

const isSocial = (p: string): p is SocialProvider =>
  (SOCIAL_PROVIDERS as readonly string[]).includes(p)

/**
 * "Continue with Google / Apple / Facebook" on the store's domain. Sends the shopper to
 * the platform login domain with a signed start request naming this store, the exact URL
 * to come back to and a hash of a random value kept in this browser's cookie, so the
 * hand-off can only complete in the browser that started it.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId, provider } = await params
  // The proxy set x-store-id from the hostname; the route param must agree.
  if ((await headers()).get('x-store-id') !== storeId) {
    return new NextResponse('Not found', { status: 404 })
  }
  const back = new URL('/account/login', request.nextUrl)
  const next = safeNextPath(request.nextUrl.searchParams.get('return_to'))
  back.searchParams.set('return_to', next)
  if (!isSocial(provider) || !(await storeLoginApp(storeId, provider))) {
    back.searchParams.set('error', 'unavailable')
    return NextResponse.redirect(back)
  }
  const connect =
    request.nextUrl.searchParams.get('connect') === '1'
      ? ((await currentCustomer(storeId))?.id ?? undefined)
      : undefined
  const browser = randomToken()
  const { origin } = await requestOrigin()
  const start: StartPayload = {
    v: 1,
    s: storeId,
    r: `${origin}${HANDOFF_RETURN_PATH}`,
    p: provider,
    b: sha256Hex(browser),
    x: next,
    m: request.nextUrl.searchParams.get('remember') === '1',
    c: connect,
    e: Date.now() + START_TTL_MS,
  }
  const to = new URL(`/oauth/${provider}/start`, accountsOrigin())
  to.searchParams.set('req', signToken(start, settingsSecret(), 'start'))
  const response = NextResponse.redirect(to)
  response.cookies.set(LOGIN_BROWSER_COOKIE, browser, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await cookieSecure(),
    path: '/account/login',
    maxAge: START_TTL_MS / 1000,
  })
  return response
}
