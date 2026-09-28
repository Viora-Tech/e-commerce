import { linkIdentity, redeemHandoff, signToken } from '@commerce/core'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { currentCustomer } from '@/lib/customer-session'
import {
  LOGIN_ERRORS,
  type LoginError,
  PENDING_LINK_TTL_MS,
  type PendingLink,
} from '@/lib/login-errors'
import {
  cookieSecure,
  LOGIN_BROWSER_COOKIE,
  PENDING_LINK_COOKIE,
  requestOrigin,
  settingsSecret,
  signInCustomer,
  takeCookie,
} from '@/lib/shopper-login'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

const loginWith = (error: LoginError) => `/account/login?error=${error}`

/**
 * Where the platform login domain hands the shopper back. The token must be for this
 * store, for exactly this URL, unexpired, unused, and opened by the browser that started
 * the sign-in; then a session starts on this domain.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId } = await params
  if ((await headers()).get('x-store-id') !== storeId) {
    return new NextResponse('Not found', { status: 404 })
  }
  const error = request.nextUrl.searchParams.get('error')
  if (error) {
    redirect(
      loginWith(
        (LOGIN_ERRORS as readonly string[]).includes(error) ? (error as LoginError) : 'failed',
      ),
    )
  }
  const browserValue = await takeCookie(LOGIN_BROWSER_COOKIE, '/account/login')
  const { origin } = await requestOrigin()
  const secret = settingsSecret()
  const result = await inStore(storeId, (tx) =>
    redeemHandoff({ tx, storeId }, request.nextUrl.searchParams.get('token'), {
      secret,
      returnUrl: `${origin}/account/login/complete`,
      browserValue,
    }),
  )
  if (!result.ok) redirect(loginWith(result.reason === 'expired' ? 'expired' : 'failed'))
  if (result.status === 'verify_email') {
    const pending: PendingLink = {
      p: result.identity.provider,
      s: result.identity.subject,
      m: result.identity.email ?? '',
      n: result.identity.name ?? '',
      r: result.remember,
      e: Date.now() + PENDING_LINK_TTL_MS,
    }
    ;(await cookies()).set(PENDING_LINK_COOKIE, signToken(pending, secret, 'pending-link'), {
      httpOnly: true,
      sameSite: 'lax',
      secure: await cookieSecure(),
      path: '/',
      maxAge: PENDING_LINK_TTL_MS / 1000,
    })
    redirect(`/account/login?confirm=1&return_to=${encodeURIComponent(result.nextPath)}`)
  }
  if (result.status === 'connect') {
    // Only for the customer signed in on this domain, in the browser that started it.
    const me = await currentCustomer(storeId)
    if (!me || me.id !== result.customerId) redirect(loginWith('failed'))
    await inStore(storeId, (tx) => linkIdentity({ tx, storeId }, me.id, result.identity))
    redirect(result.nextPath)
  }
  await signInCustomer(storeId, result.customerId, result.remember)
  redirect(result.nextPath)
}
