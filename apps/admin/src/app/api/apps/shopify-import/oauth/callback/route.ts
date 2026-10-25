import { settingsSecret } from '@commerce/config'
import {
  checkInstallCallback,
  exchangeInstallCode,
  LAUNCH_STORE,
  sealInstallGrant,
  shopifyAppFromEnv,
} from '@commerce/plugin-shopify-import/server'
import { type NextRequest, NextResponse } from 'next/server'
import { adminUrl } from '@/lib/admin-origin'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { withEvlog } from '@/lib/request-log'
import { routes } from '@/lib/routes'
import { INSTALL_GRANT_COOKIE, INSTALL_GRANT_PATH } from '@/lib/shopify-install'

/** Shopify's code can be swapped once and soon, so the grant cookie lives as long as its seal. */
const GRANT_MAX_AGE = 30 * 60

/**
 * Shopify sends the merchant back here after they installed the Koomerce migration app on
 * their shop, with `code`, `shop`, `state`, `timestamp` and Shopify's `hmac` over them.
 * - Signed in: the router checks the hmac and that the state is for this store (or for no store,
 *   when Shopify started the install), swaps the code for an expiring offline token and saves it;
 *   the merchant lands on the importer's Connect page.
 * - Signed out, after an install Shopify started: the code is swapped now and the access sealed
 *   into a short-lived cookie; sign-in comes next and the claim route connects it.
 */
export const GET = withEvlog(async (req: NextRequest) => {
  const back = adminUrl(routes.apps.page('shopify-import', 'connect'))
  const query = req.nextUrl.searchParams
  if (!query.get('code') || !query.get('state')) {
    back.searchParams.set('connect', 'cancelled')
    return NextResponse.redirect(back)
  }
  if (!(await getSession())) return holdForSignIn(query, back)
  try {
    const context = await serverContext()
    await call(
      appRouter.shopifyImport.completeAppInstall,
      { callback: query.toString() },
      { context },
    )
    back.searchParams.set('connect', 'connected')
  } catch {
    back.searchParams.set('connect', 'failed')
  }
  return NextResponse.redirect(back)
})

async function holdForSignIn(query: URLSearchParams, back: URL) {
  const app = shopifyAppFromEnv(process.env)
  try {
    if (!app) throw new Error('The Shopify app is not set up')
    const cb = checkInstallCallback(query, app, settingsSecret())
    // An install started from our own Connect page belongs to a store; sign in and start again.
    if (cb.storeId !== LAUNCH_STORE) throw new Error('Install started for a store')
    const token = await exchangeInstallCode(app, cb.shop, cb.code)
    const login = adminUrl(routes.login())
    login.searchParams.set('next', `${INSTALL_GRANT_PATH}/oauth/claim`)
    const res = NextResponse.redirect(login)
    res.cookies.set(
      INSTALL_GRANT_COOKIE,
      sealInstallGrant({ shop: cb.shop, token }, settingsSecret()),
      {
        httpOnly: true,
        secure: login.protocol === 'https:',
        sameSite: 'lax',
        path: INSTALL_GRANT_PATH,
        maxAge: GRANT_MAX_AGE,
      },
    )
    return res
  } catch {
    back.searchParams.set('connect', 'failed')
    return NextResponse.redirect(back)
  }
}
