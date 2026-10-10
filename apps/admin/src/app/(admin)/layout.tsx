import { loadEnv } from '@commerce/config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import AdminFrame from '@/components/admin-frame'
import AccentStyle from '@/components/layout/accent-style'
import { appRouter, call, serverContext } from '@/lib/api'
import { auth, getSession } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { storefrontOrigin } from '@/lib/storefront-origin'
import SelectStore from './select-store/select-store'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect(routes.login())

  const orgs = await auth().api.listOrganizations({ headers: await headers() })
  // No store at all yet: send them to create one, which shows the invite-only
  // screen instead of the wizard when they are not allowed to sign up.
  if (orgs.length === 0) redirect(routes.onboarding())
  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  const active = orgs.find((o) => o.id === activeId) ?? null
  // Installed apps with screens get their own sidebar entry under Apps.
  const apps = active
    ? await call(appRouter.apps.list, undefined, { context: await serverContext() }).catch(() => [])
    : []
  const appLinks = apps
    .filter((a) => a.installed && a.admin.pages.length > 0)
    .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon }))

  // The sidebar's brand mark reuses the storefront theme's logo when the store has set one.
  const themes = active
    ? await call(appRouter.themes.list, undefined, { context: await serverContext() }).catch(
        () => [],
      )
    : []
  const liveTheme = themes.find((t) => t.role === 'main')
  const logoUrl = liveTheme?.settings.brand.logo?.url ?? null
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
        storefrontUrl={await storefrontOrigin()}
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
