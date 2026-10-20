import 'server-only'
import { headers } from 'next/headers'
import { cache } from 'react'
import { appRouter, call, serverContext } from './api'
import { auth } from './auth'

/**
 * Reads the admin shell and its pages both need, once per server render (React `cache`): the
 * layout and the page ask for the same things (Home and an order also list the apps). Nothing
 * here is shared across requests, so one member never sees another's stores or apps.
 */

/** The member's stores (Better Auth organizations), for the store switcher. */
export const listStores = cache(async () =>
  auth().api.listOrganizations({ headers: await headers() }),
)

/** The active store's apps (installed and not); rejects without a store or permission. */
export const listApps = cache(async () =>
  call(appRouter.apps.list, undefined, { context: await serverContext() }),
)

/** Orders waiting to ship, for the sidebar's Orders count; null without permission. */
export const ordersToShipCount = cache(async () =>
  call(appRouter.orders.toShipCount, undefined, { context: await serverContext() }).catch(
    () => null,
  ),
)

/** A gateway at checkout runs on test keys (the admin-wide banner); false without permission. */
export const paymentsTestMode = cache(async () =>
  call(appRouter.payments.testMode, undefined, { context: await serverContext() })
    .then((r) => r.testMode)
    .catch(() => false),
)

/** The live theme's logo for the sidebar's brand mark; null when unset or not readable. */
export const liveLogoUrl = cache(async () =>
  call(appRouter.themes.logo, undefined, { context: await serverContext() }).catch(() => null),
)

/** The sidebar's "Orders this month · 142 of 200"; null when the member cannot read settings. */
export const planUsageSummary = cache(async () =>
  call(appRouter.billing.usage, undefined, { context: await serverContext() }).catch(() => null),
)
