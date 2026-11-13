import { liveThemeLogoUrl, permissions } from '@commerce/core'
import { inboxCounts, inboxState } from '@commerce/core/inbox/server'
import { storeProcedure } from '../procedures'
import { approvalCounts } from '../services/ai/assistant/activity'
import { installedAppBars } from '../services/app-bar.service'
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
  const [appsAndBars, logo, toShip, usage, testMode, approvals, inbox, drafts] = await Promise.all([
    // The installed apps' app bar extras (status pill, sidebar page counts) ride on the app list:
    // only installed apps that declare an `appBar` read are asked, one statement each.
    settings
      ? listStoreApps(tx, storeId).then(async (list) => ({
          list,
          bars: await installedAppBars(
            tx,
            storeId,
            new Set(list.filter((a) => a.installed).map((a) => a.id)),
            can,
          ),
        }))
      : null,
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
  return {
    apps: appsAndBars?.list ?? null,
    /** By app id: each installed app's status pill and sidebar page counts; null without `settings.read`. */
    appBars: appsAndBars?.bars ?? null,
    logo,
    toShip,
    usage,
    testMode,
    approvals,
    inbox,
    drafts,
  }
})
