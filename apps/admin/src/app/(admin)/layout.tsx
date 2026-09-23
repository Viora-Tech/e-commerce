import { loadEnv } from '@commerce/config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import AdminFrame from '@/components/admin-frame'
import AccentStyle from '@/components/layout/accent-style'
import { appRouter, call, serverContext } from '@/lib/api'
import { auth, getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const orgs = await auth().api.listOrganizations({ headers: await headers() })
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

  return (
    <>
      <AccentStyle organizationId={active?.id ?? null} />
      <AdminFrame
        user={{ name: session.user.name, email: session.user.email }}
        stores={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))}
        activeStoreId={active?.id ?? null}
        storefrontUrl={loadEnv(process.env).STOREFRONT_URL}
        apps={appLinks}
      >
        {children}
      </AdminFrame>
    </>
  )
}
