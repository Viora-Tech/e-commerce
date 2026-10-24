import { NextResponse } from 'next/server'
import { adminUrl } from '@/lib/admin-origin'
import { appRouter, call, serverContext } from '@/lib/api'
import { withEvlog } from '@/lib/request-log'
import { routes } from '@/lib/routes'
import { INSTALL_GRANT_COOKIE, INSTALL_GRANT_PATH } from '@/lib/shopify-install'

/**
 * After signing in, a Shopify install that started signed out: the callback sealed the access
 * into a short-lived cookie; this connects it to the member's current store, once.
 */
export const GET = withEvlog(async (req: Request) => {
  const back = adminUrl(routes.apps.page('shopify-import', 'connect'))
  const grant = req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${INSTALL_GRANT_COOKIE}=`))
    ?.slice(INSTALL_GRANT_COOKIE.length + 1)
  if (!grant) return NextResponse.redirect(back)
  try {
    const context = await serverContext()
    await call(
      appRouter.shopifyImport.claimAppInstall,
      { grant: decodeURIComponent(grant) },
      { context },
    )
    back.searchParams.set('connect', 'connected')
  } catch {
    back.searchParams.set('connect', 'failed')
  }
  const res = NextResponse.redirect(back)
  res.cookies.delete({ name: INSTALL_GRANT_COOKIE, path: INSTALL_GRANT_PATH })
  return res
})
