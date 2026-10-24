import { type NextRequest, NextResponse } from 'next/server'
import { adminUrl } from '@/lib/admin-origin'
import { appRouter, call, serverContext } from '@/lib/api'
import { withEvlog } from '@/lib/request-log'
import { routes } from '@/lib/routes'

/**
 * Shopify sends the merchant back here after they installed the Koomerce migration app on
 * their shop, with `code`, `shop`, `state`, `timestamp` and Shopify's `hmac` over them. The
 * router checks the hmac, that the state is for the signed-in store, swaps the code for an
 * expiring offline token and saves it; the merchant lands on the importer's Connect page.
 */
export const GET = withEvlog(async (req: NextRequest) => {
  const back = adminUrl(routes.apps.page('shopify-import', 'connect'))
  const query = req.nextUrl.searchParams
  if (!query.get('code') || !query.get('state')) {
    back.searchParams.set('connect', 'cancelled')
    return NextResponse.redirect(back)
  }
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
