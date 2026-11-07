import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import InstallStorePicker from '@/components/apps/install/install-store-picker'
import InstalledApps from '@/components/apps/installed/installed-apps'
import { getSession } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { listApps, listStores, storesWithApp } from '@/lib/shell-data'

export const metadata: Metadata = { title: 'Install app' }

type Props = { searchParams: Promise<{ app?: string | string[]; store?: string | string[] }> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * `/apps/install?app=<pluginId>`: the install flow for one app, over the Installed apps list. The
 * entry point for the App Store website: sign-in comes first like any admin page (the layout
 * returns here after it), then a member of several stores picks one (`&store=<id>` once picked),
 * then Connect, Permissions and Done.
 */
export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const id = first(params.app)
  if (!id) redirect(routes.apps.list())

  const [session, stores] = await Promise.all([getSession(), listStores()])
  const activeId =
    (session?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null
  const chosen = first(params.store)
  if (stores.length > 1 && chosen !== activeId) {
    const [apps, installedIn] = await Promise.all([listApps().catch(() => []), storesWithApp(id)])
    return (
      <InstallStorePicker
        appId={id}
        appName={apps.find((a) => a.id === id)?.name ?? id}
        stores={stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        activeStoreId={activeId}
        installedStoreIds={installedIn}
      />
    )
  }
  return <InstalledApps installId={id} />
}
