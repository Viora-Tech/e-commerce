import { settingsSecret } from '@commerce/config'
import {
  checkReturnUrl,
  finishSignIn,
  mintHandoff,
  openToken,
  planConnect,
  resolveShopperIdentity,
  type ShopperIdentity,
  type StartPayload,
  storeLoginHosts,
} from '@commerce/core'
import { safeEqual } from '@commerce/payments'
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

type CallbackInput = {
  code: string | null
  state: string | null
  error: string | null
  /** Apple's first sign-in only: `{ name: { firstName, lastName } }` as JSON. */
  user: string | null
}

const plain = (body: string, status = 400) =>
  new NextResponse(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

async function handle(request: NextRequest, provider: string, input: CallbackInput) {
  const secret = settingsSecret()
  const sealed = openToken<OAuthState>(request.cookies.get(OAUTH_COOKIE)?.value, secret, 'oauth')
  if (!sealed.ok || !input.state || !safeEqual(input.state, sealed.payload.st)) {
    return plain(accountsContent.expired)
  }
  const opened = openToken<StartPayload>(sealed.payload.q, secret, 'start')
  if (!opened.ok || opened.payload.p !== provider) return plain(accountsContent.expired)
  const start = opened.payload
  const hosts = await inStore(start.s, (tx) => storeLoginHosts({ tx, storeId: start.s }))
  const returnUrl = checkReturnUrl(start.r, hosts, { dev: isDev() })
  if (!returnUrl) return plain(accountsContent.notAllowed)
  // POST (Apple) answers with 303 so the browser follows with a GET.
  const back = (query: string) => {
    const res = NextResponse.redirect(`${returnUrl}?${query}`, 303)
    res.cookies.set(OAUTH_COOKIE, '', { path: `/oauth/${start.p}`, maxAge: 0 })
    return res
  }
  if (input.error || !input.code) return back('error=cancelled')
  const app = await storeLoginApp(start.s, start.p)
  if (!app) return back('error=unavailable')
  let identity: ShopperIdentity | null = null
  try {
    identity = await finishSignIn(app, {
      code: input.code,
      codeVerifier: sealed.payload.cv,
      redirectURI: oauthCallbackUrl(start.p),
      appleUser: parseJson(input.user),
    })
  } catch {
    identity = null
  }
  if (!identity) return back('error=failed')
  const found = identity
  const token = await inStore(start.s, async (tx) => {
    const ctx = { tx, storeId: start.s }
    const connectTo = start.c
    if (connectTo) {
      // Never linked here: the store's domain links it after checking the browser.
      if ((await planConnect(ctx, found, connectTo)) === 'conflict') return 'conflict'
      return mintHandoff(
        ctx,
        {
          status: 'connect',
          customerId: connectTo,
          identity: found,
          returnUrl,
          browserHash: start.b,
          nextPath: start.x,
          remember: start.m,
        },
        secret,
      )
    }
    const resolved = await resolveShopperIdentity(ctx, found, { secret })
    if (resolved.kind === 'no_email' || resolved.kind === 'conflict') return resolved.kind
    // Only Truecaller carries a verified mobile, and it never comes through OAuth.
    if (resolved.kind === 'verify_phone') return 'conflict'
    return mintHandoff(
      ctx,
      {
        status: resolved.kind === 'signed_in' ? 'ready' : 'verify_email',
        customerId: resolved.kind === 'signed_in' ? resolved.customerId : null,
        identity: resolved.kind === 'verify_email' ? found : undefined,
        returnUrl,
        browserHash: start.b,
        nextPath: start.x,
        remember: start.m,
      },
      secret,
    )
  })
  if (token === 'no_email' || token === 'conflict') return back(`error=${token}`)
  return back(`token=${encodeURIComponent(token)}`)
}

/** Google and Facebook come back with a GET. */
export const GET = withEvlog(async (request: NextRequest, { params }: Params) => {
  const q = request.nextUrl.searchParams
  return handle(request, (await params).provider, {
    code: q.get('code'),
    state: q.get('state'),
    error: q.get('error'),
    user: null,
  })
})

/** Apple posts the form (`response_mode=form_post`). */
export const POST = withEvlog(async (request: NextRequest, { params }: Params) => {
  const form = await request.formData().catch(() => null)
  const field = (k: string) => {
    const v = form?.get(k)
    return typeof v === 'string' ? v : null
  }
  return handle(request, (await params).provider, {
    code: field('code'),
    state: field('state'),
    error: field('error'),
    user: field('user'),
  })
})
