import { SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import { type NextRequest, NextResponse } from 'next/server'
import { appRouter, call, serverContext } from '@/lib/api'
import { withEvlog } from '@/lib/request-log'
import { routes } from '@/lib/routes'

/**
 * Google sends the merchant back here after "Connect Google Search Console" with a one-time
 * `code` and our signed `state` (or `error=access_denied` when they said no). The router checks
 * the state belongs to the signed-in store, swaps the code for tokens and saves them; the
 * merchant lands on the app's Settings either way, to pick the property.
 */
export const GET = withEvlog(async (req: NextRequest) => {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const back = new URL(routes.apps.settings(SEARCH_CONSOLE_APP_ID), req.nextUrl.origin)
  if (!code || !state) {
    back.searchParams.set('connect', 'cancelled')
    return NextResponse.redirect(back)
  }
  try {
    const context = await serverContext()
    await call(appRouter.searchConsole.connectComplete, { code, state }, { context })
    back.searchParams.set('connect', 'connected')
  } catch {
    back.searchParams.set('connect', 'failed')
  }
  return NextResponse.redirect(back)
})
