import { loadEnv, settingsSecret } from '@commerce/config'
import { shopifyAppFromEnv, shopifyLaunchUrl } from '@commerce/plugin-shopify-import/server'
import { type NextRequest, NextResponse } from 'next/server'
import { adminUrl } from '@/lib/admin-origin'
import { withEvlog } from '@/lib/request-log'
import { routes } from '@/lib/routes'

/**
 * The Shopify app's URL (`application_url`): Shopify opens it with a signed `shop` after an
 * install from the App Store and on every "Open app". It goes straight to Shopify's authorize
 * screen for that shop (Shopify's review requires this before any page of ours); the callback
 * then connects the signed-in store, or holds the access until the merchant signs in. Anything
 * unsigned lands on the importer's Connect page.
 */
export const GET = withEvlog(async (req: NextRequest) => {
  const app = shopifyAppFromEnv(process.env)
  const url = app
    ? shopifyLaunchUrl(app, req.nextUrl.searchParams, {
        adminUrl: loadEnv(process.env).ADMIN_URL,
        secret: settingsSecret(),
      })
    : null
  return NextResponse.redirect(url ?? adminUrl(routes.apps.page('shopify-import', 'connect')))
})
