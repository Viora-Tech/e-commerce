import 'server-only'
import { resolveHost, storeMarkets } from '@commerce/db'
import { cookies, headers } from 'next/headers'
import { db } from './db'
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE, switchMarket } from './markets'
import { hostnameFromHeader } from './store-resolver'

/** The page a form was posted from: its own `return_to`, else the referer when it is this site. */
function pageOf(form: FormData | null, req: Request): string {
  const own = form?.get('return_to')
  if (typeof own === 'string' && own) return own
  const referer = req.headers.get('referer')
  if (!referer) return '/'
  try {
    const from = new URL(referer)
    return from.host === req.headers.get('host') ? from.pathname + from.search : '/'
  } catch {
    return '/'
  }
}

/**
 * The theme's country and language selector (`{% form 'localization' %}` posts to
 * `/theme-actions/localization`): save the shopper's choice and go back to the same page in that
 * market and language (`switchMarket`).
 */
export async function localizationAction(req: Request, storeId: string): Promise<Response> {
  const form = await req.formData().catch(() => null)
  const field = (name: string) => {
    const v = form?.get(name)
    return typeof v === 'string' ? v : ''
  }
  const hostname = hostnameFromHeader(req.headers.get('host')) ?? ''
  const [markets, route] = await Promise.all([
    storeMarkets(db(), storeId).catch(() => []),
    hostname ? resolveHost(db(), hostname) : null,
  ])
  const jar = await cookies()
  const { location, saved } = switchMarket({
    markets,
    hostname,
    primaryHostname: route?.primaryHostname ?? null,
    returnTo: pageOf(form, req),
    cookie: jar.get(MARKET_COOKIE)?.value,
    country: field('country_code'),
    language: field('language_code'),
  })
  if (saved) {
    const proto = (await headers()).get('x-forwarded-proto')
    jar.set(MARKET_COOKIE, saved, {
      httpOnly: true,
      sameSite: 'lax',
      secure: proto === 'https' || process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MARKET_COOKIE_MAX_AGE,
    })
  }
  return new Response(null, { status: 303, headers: { location } })
}
