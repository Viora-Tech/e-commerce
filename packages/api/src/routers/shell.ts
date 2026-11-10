import { liveThemeLogoUrl, permissions } from '@commerce/core'
import { inboxCounts, inboxState } from '@commerce/core/inbox/server'
import { storeProcedure } from '../procedures'
import { approvalCounts } from '../services/ai/assistant/activity'
import { unseenCheckoutDrafts } from '../services/drafts-seen.service'
import { readyToShipCount } from '../services/order.service'
import { paymentsTestMode } from '../services/payments-setup.service'
import { listStoreApps } from './apps'
import { planUsageCard } from './billing'

/**
 * `store.shell`: everything the admin layout reads on every page, in one call and so one
 * transaction. It used to be seven calls (`apps.list`, `themes.logo`, `orders.toShipCount`,
 * `billing.usage`, `payments.testMode`, `approvals.counts`, `inbox.counts`), each with its own
 * transaction, store lookup and settings round trip, all taking pool connections at once.
 * Each part is `null` when the member's role cannot read it, which is what the separate call
 * answered (the layout caught its refusal); `testMode` is `false` then.
 */
export const shellProcedure = storeProcedure.handler(async ({ context }) => {
  const { tx, scope } = context
  const storeId = scope.storeId
  const can = (permission: Parameters<typeof scope.can>[0]) => scope.can(permission)
  const settings = can(permissions.SETTINGS_READ)
  const [apps, logo, toShip, usage, testMode, approvals, inbox, drafts] = await Promise.all([
    settings ? listStoreApps(tx, storeId) : null,
    can(permissions.ONLINE_STORE_READ) ? liveThemeLogoUrl(tx) : null,
    can(permissions.ORDERS_READ) ? readyToShipCount(tx) : null,
    settings ? planUsageCard(tx, storeId) : null,
    settings ? paymentsTestMode(tx, storeId) : false,
    approvalCounts({ storeId, tx }, scope),
    // `inbox.counts` refuses until the Inbox app is installed.
    can(permissions.INBOX_READ)
      ? inboxState(tx, storeId).then((state) =>
          state.installed ? inboxCounts({ storeId, tx }, scope.userId) : null,
        )
      : null,
    // Shoppers' unpaid checkout drafts this member has not seen on the Drafts page.
    can(permissions.DRAFTS_READ) ? unseenCheckoutDrafts(tx, storeId, scope.userId) : null,
  ])
  return { apps, logo, toShip, usage, testMode, approvals, inbox, drafts }
})
