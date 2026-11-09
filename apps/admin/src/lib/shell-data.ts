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

/** The member's stores that already have this app; none when it cannot be read. */
export const storesWithApp = cache(async (appId: string) =>
  call(appRouter.account.storesWithApp, { appId }, { context: await serverContext() }).catch(
    (): string[] => [],
  ),
)

/**
 * The layout's per-page store reads in one call (`store.shell`), so one transaction: the
 * helpers below read their part of it. Rejects without a store, like the calls it replaced.
 */
const shell = cache(async () =>
  call(appRouter.store.shell, undefined, { context: await serverContext() }),
)

/** The active store's apps (installed and not); rejects without a store or permission. */
export const listApps = cache(async () => {
  const { apps } = await shell()
  if (!apps) throw new Error('Your role cannot read apps')
  return apps
})

/** Orders waiting to ship, for the sidebar's Orders count; null without permission. */
export const ordersToShipCount = cache(async () =>
  shell()
    .then((s) => s.toShip)
    .catch(() => null),
)

/**
 * Settings → Approvals, for the sidebar count: changes waiting for this member's approval plus
 * decisions on their own requests they have not opened yet; null when it cannot be read.
 */
export const approvalsBadgeCount = cache(async () =>
  shell()
    .then((s) => s.approvals.waiting + s.approvals.outcomes)
    .catch(() => null),
)

/** Open Inbox conversations with unread shopper messages, for the sidebar count; null without access. */
export const inboxUnreadCount = cache(async () =>
  shell()
    .then((s) => s.inbox?.unread ?? null)
    .catch(() => null),
)

/** A gateway at checkout runs on test keys (the admin-wide banner); false without permission. */
export const paymentsTestMode = cache(async () =>
  shell()
    .then((s) => s.testMode)
    .catch(() => false),
)

/** The live theme's logo for the sidebar's brand mark; null when unset or not readable. */
export const liveLogoUrl = cache(async () =>
  shell()
    .then((s) => s.logo)
    .catch(() => null),
)

/** The sidebar's "Orders this month · 142 of 200"; null when the member cannot read settings. */
export const planUsageSummary = cache(async () =>
  shell()
    .then((s) => s.usage)
    .catch(() => null),
)
