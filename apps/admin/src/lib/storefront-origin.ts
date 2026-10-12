import 'server-only'
import { loadEnv } from '@commerce/config'
import { cache } from 'react'
import { appRouter, call, serverContext } from './api'

/**
 * The active store's public origin for every "View store", preview and share link:
 * `https://<live primary domain>` from `store.origin`. STOREFRONT_URL belongs to no store on
 * a multi-tenant server ("No store is configured for ..."), so it is only the fallback for a
 * store without a live primary domain, or when no store is picked yet. Read once per server
 * render: the layout and the page often both need it.
 */
export const storefrontOrigin = cache(async (): Promise<string> => {
  const fallback = new URL(loadEnv(process.env).STOREFRONT_URL).origin
  return call(appRouter.store.origin, undefined, { context: await serverContext() }).catch(
    () => fallback,
  )
})
