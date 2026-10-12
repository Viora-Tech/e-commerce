import { loadEnv } from '@commerce/config'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import AdminFrame from '@/components/admin-frame'
import AccentStyle from '@/components/layout/accent-style'
import { appEntryHref } from '@/lib/apps-gallery'
import { getSession } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { listApps, listStores, liveLogoUrl } from '@/lib/shell-data'
import { storefrontOrigin } from '@/lib/storefront-origin'
import SelectStore from './select-store/select-store'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect(routes.login())

  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  // Everything else needs only the session, so it is read at once rather than one after
  // another. Store calls for a stale active id answer "no store" on their own and are dropped
  // below unless that store is one of the member's.
  const [orgs, apps, logo, storefrontUrl] = await Promise.all([
    listStores(),
    activeId ? listApps().catch(() => []) : [],
    activeId ? liveLogoUrl() : null,
    storefrontOrigin(),
  ])
  // No store at all yet: send them to create one, which shows the invite-only
  // screen instead of the wizard when they are not allowed to sign up.
  if (orgs.length === 0) redirect(routes.onboarding())
  const active = orgs.find((o) => o.id === activeId) ?? null
  // Every installed app gets a sidebar entry under Apps (its pages, or its settings page).
  const appLinks = active
    ? apps
        .filter((a) => a.installed && a.id !== 'core')
        .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon, href: appEntryHref(a) }))
    : []
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
        // Test server only. A report is filed against a store, so none before one is picked.
        bugReports={loadEnv(process.env).BUG_REPORTS_ENABLED && active !== null}
      >
        {/* No active org yet: auto-pick it when the member belongs to exactly one store, else
            show the picker instead of letting every page below throw "Pick a store first". */}
        {active ? children : <SelectStore stores={storeOptions} autoSelect />}
      </AdminFrame>
    </>
  )
}
