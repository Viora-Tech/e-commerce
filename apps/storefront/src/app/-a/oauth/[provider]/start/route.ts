import { settingsSecret } from '@commerce/config'
import {
  authorizationUrl,
  checkReturnUrl,
  openToken,
  randomToken,
  START_TTL_MS,
  type StartPayload,
  signToken,
  storeLoginHosts,
} from '@commerce/core'
import { type NextRequest, NextResponse } from 'next/server'
import { accountsContent } from '@/data/accounts-domain'
import { withEvlog } from '@/lib/request-log'
import {
  isDev,
  OAUTH_COOKIE,
  type OAuthState,
  oauthCallbackUrl,
  storeLoginApp,
} from '@/lib/shopper-login'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ provider: string }> }

/**
 * Platform login domain: check the signed start request (store, return URL on one of
 * that store's live domains), then send the shopper to the provider with a fresh state
 * and PKCE verifier kept in a cookie on this domain.
 */
export const GET = withEvlog(async (request: NextRequest, { params }: Params) => {
  const { provider } = await params
  const secret = settingsSecret()
  const req = request.nextUrl.searchParams.get('req') ?? ''
  const opened = openToken<StartPayload>(req, secret, 'start')
  if (!opened.ok || opened.payload.p !== provider) {
    return new NextResponse(accountsContent.expired, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const start = opened.payload
  const hosts = await inStore(start.s, (tx) => storeLoginHosts({ tx, storeId: start.s }))
  const returnUrl = checkReturnUrl(start.r, hosts, { dev: isDev() })
  if (!returnUrl) {
    return new NextResponse(accountsContent.notAllowed, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const app = await storeLoginApp(start.s, start.p)
  if (!app) return NextResponse.redirect(`${returnUrl}?error=unavailable`)
  const state: OAuthState = {
    st: randomToken(),
    cv: randomToken(48),
    q: req,
    e: Date.now() + START_TTL_MS,
  }
  const url = await authorizationUrl(app, {
    redirectURI: oauthCallbackUrl(start.p),
    state: state.st,
    codeVerifier: state.cv,
  })
  const response = NextResponse.redirect(url)
  // Apple answers with a cross-site form POST, which only carries a SameSite=None cookie.
  const https = request.nextUrl.protocol === 'https:' || !isDev()
  response.cookies.set(OAUTH_COOKIE, signToken(state, secret, 'oauth'), {
    httpOnly: true,
    secure: https,
    sameSite: start.p === 'apple' && https ? 'none' : 'lax',
    path: `/oauth/${start.p}`,
    maxAge: START_TTL_MS / 1000,
  })
  return response
})
