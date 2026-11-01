import 'server-only'
import { resolveHost, storeMarkets } from '@commerce/db'
import { cookies, headers } from 'next/headers'
import { db } from './db'
import { marketSuggestion } from './market-suggestion'
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

/**
 * `GET /theme-actions/market-suggestion?path=<the page>`: the "Shopping from …?" banner's
 * answer for this visitor (`marketSuggestion`). Asked by the browser after the page loads, so a
 * page a CDN keeps for everyone never carries one visitor's country; this answer is never stored.
 * Outside production `?country=XX` stands in for Cloudflare's country, for testing.
 */
export async function marketSuggestionAction(req: Request, storeId: string): Promise<Response> {
  const url = new URL(req.url)
  const hostname = hostnameFromHeader(req.headers.get('host')) ?? ''
  const fake = process.env.NODE_ENV !== 'production' ? url.searchParams.get('country') : null
  const [markets, route] = await Promise.all([
    storeMarkets(db(), storeId).catch(() => []),
    hostname ? resolveHost(db(), hostname) : null,
  ])
  const suggestion = marketSuggestion({
    markets,
    hostname,
    primaryHostname: route?.primaryHostname ?? null,
    pathname: sameSitePathname(url.searchParams.get('path') ?? '/'),
    cookie: (await cookies()).get(MARKET_COOKIE)?.value,
    visitorCountry: fake || req.headers.get('x-visitor-country'),
    userAgent: req.headers.get('user-agent'),
  })
  return Response.json({ suggestion }, { headers: { 'cache-control': 'private, no-store' } })
}

/** Only the path of a page on this site; anything else is the home page. */
function sameSitePathname(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value.split(/[?#]/)[0] || '/' : '/'
}
