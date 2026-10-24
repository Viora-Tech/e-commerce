import { loadEnv } from '@commerce/config'
import { nextPlanUp } from '@commerce/core/billing'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import AdminFrame from '@/components/admin-frame'
import AccentStyle from '@/components/layout/accent-style'
import PaymentsTestBanner from '@/components/layout/payments-test-banner'
import { billingContent } from '@/data/billing'
import { appEntryHref } from '@/lib/apps-gallery'
import { getSession } from '@/lib/auth'
import { REQUEST_PATH_HEADER } from '@/lib/csp'
import { routes, safeNext } from '@/lib/routes'
import {
  inboxUnreadCount,
  listApps,
  listStores,
  liveLogoUrl,
  ordersToShipCount,
  paymentsTestMode,
  planUsageSummary,
} from '@/lib/shell-data'
import { storefrontOrigin } from '@/lib/storefront-origin'
import SelectStore from './select-store/select-store'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) {
    // Back to the page that was asked for after signing in (an App Store "Install" link).
    const asked = safeNext((await headers()).get(REQUEST_PATH_HEADER) ?? undefined)
    redirect(routes.login(asked && asked !== routes.home() ? asked : undefined))
  }

  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  // Everything else needs only the session, so it is read at once rather than one after
  // another. Store calls for a stale active id answer "no store" on their own and are dropped
  // below unless that store is one of the member's.
  const [orgs, apps, logo, storefrontUrl, toShip, plan, testMode] = await Promise.all([
    listStores(),
    activeId ? listApps().catch(() => []) : [],
    activeId ? liveLogoUrl() : null,
    storefrontOrigin(),
    activeId ? ordersToShipCount() : null,
    activeId ? planUsageSummary() : null,
    activeId ? paymentsTestMode() : false,
  ])
  // No store at all yet: send them to create one, which shows the invite-only
  // screen instead of the wizard when they are not allowed to sign up.
  if (orgs.length === 0) redirect(routes.onboarding())
  const active = orgs.find((o) => o.id === activeId) ?? null
  // Every installed app gets a sidebar entry under Apps (its pages, or its settings page);
  // sales channel apps (Inbox) sit under Sales channels instead.
  const installed = active ? apps.filter((a) => a.installed && a.id !== 'core') : []
  const channels = installed.filter((a) => a.admin.salesChannel).map((a) => a.id)
  const appLinks = installed
    .filter((a) => !a.admin.salesChannel)
    .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon, href: appEntryHref(a) }))
  const inboxUnread = channels.includes('inbox') ? await inboxUnreadCount() : null
  const navCounts: Record<string, number> = {
    ...(active && toShip ? { [routes.orders.list()]: toShip } : {}),
    ...(inboxUnread ? { [routes.salesChannels.inboxConversations()]: inboxUnread } : {}),
  }
  // The sidebar's brand mark reuses the storefront theme's logo when the store has set one.
  const logoUrl = active ? logo : null
  const storeOptions = orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))

  return (
    <>
      <AccentStyle organizationId={active?.id ?? null} />
      <AdminFrame
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        stores={storeOptions}
        activeStoreId={active?.id ?? null}
        storefrontUrl={storefrontUrl}
        apps={appLinks}
        logoUrl={logoUrl}
        channels={channels}
        navCounts={navCounts}
        usage={
          active && plan
            ? {
                used: plan.used,
                limit: plan.limit,
                // "More room on Growth plan": the next plan up (Pro has no bigger plan).
                planName: billingContent.plans[nextPlanUp(plan.plan) ?? plan.plan].name,
              }
            : undefined
        }
        // Test server only. A report is filed against a store, so none before one is picked.
        bugReports={loadEnv(process.env).BUG_REPORTS_ENABLED && active !== null}
      >
        {/* No active org yet: auto-pick it when the member belongs to exactly one store, else
            show the picker instead of letting every page below throw "Pick a store first". */}
        {active ? (
          <>
            {testMode ? <PaymentsTestBanner /> : null}
            {children}
          </>
        ) : (
          <SelectStore stores={storeOptions} autoSelect />
        )}
      </AdminFrame>
    </>
  )
}
