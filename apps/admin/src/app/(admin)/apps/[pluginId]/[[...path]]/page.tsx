import { notFound, redirect } from 'next/navigation'
import { ADMIN_APPS, matchAppPage } from '@/apps/registry'
import AppListing from '@/components/apps/app-listing'
import AppShell from '@/components/apps/app-shell'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

type Params = { params: Promise<{ pluginId: string; path?: string[] }> }

/**
 * An installed app's pages, Shopify style: `/apps/<pluginId>/<path>` inside the
 * normal admin shell. The manifest lists the pages; the admin registry holds
 * the components.
 */
export default async function AppPage({ params }: Params) {
  const { pluginId, path = [] } = await params
  const context = await serverContext()
  const apps = await call(appRouter.apps.list, undefined, { context }).catch(orNoStore(undefined))
  if (apps === undefined) redirect(routes.selectStore())
  const app = apps.find((a) => a.id === pluginId)
  if (!app) notFound()
  if (!app.installed) {
    return (
      <PageBody>
        <AppListing app={app} />
      </PageBody>
    )
  }
  const registered = ADMIN_APPS[pluginId]
  if (!registered) notFound()
  const match = matchAppPage(app.admin.pages, path)
  const Page = match ? registered.pages[match.page.path] : undefined
  if (!match || !Page) notFound()
  const tabs = app.admin.pages.flatMap((p) =>
    p.navLabel ? [{ path: p.path, label: p.navLabel }] : [],
  )
  return (
    <AppShell
      appId={app.id}
      name={app.name}
      icon={app.admin.icon}
      description={app.description}
      credits={app.credits}
      hasSettings={app.admin.pages.some((p) => p.path === 'settings')}
      tabs={tabs}
      active={match.page.path}
    >
      <Page params={match.params} />
    </AppShell>
  )
}
