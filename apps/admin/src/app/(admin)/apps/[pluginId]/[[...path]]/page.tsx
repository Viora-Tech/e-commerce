import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ADMIN_APPS, matchAppPage } from '@/apps/registry'
import AppListing from '@/components/apps/app-listing'
import AppShell from '@/components/apps/app-shell'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

type Params = { params: Promise<{ pluginId: string; path?: string[] }> }

/** The tab reads the app's name, with the page's tab label after the first page. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pluginId, path = [] } = await params
  const context = await serverContext()
  const apps = await call(appRouter.apps.list, undefined, { context }).catch(() => [])
  const app = apps.find((a) => a.id === pluginId)
  if (!app) return { title: 'Apps' }
  const page = app.installed ? matchAppPage(app.admin.pages, path)?.page : undefined
  const first = app.admin.pages.find((p) => p.navLabel)
  return {
    title:
      page?.navLabel && page.path !== first?.path ? `${page.navLabel} · ${app.name}` : app.name,
  }
}

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
  if (registered.fullPages?.includes(match.page.path)) {
    return (
      <PageBody>
        <Page params={match.params} />
      </PageBody>
    )
  }
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
      status={app.status}
      problem={app.problem}
      fixHref={
        // A connected app whose last run failed is fixed by running it again from its own
        // first page, not by connecting again (#76).
        app.status === 'error' && app.connected
          ? routes.apps.page(app.id)
          : app.admin.pages.some((p) => p.path === 'connect')
            ? routes.apps.connect(app.id)
            : app.admin.pages.some((p) => p.path === 'settings')
              ? routes.apps.settings(app.id)
              : undefined
      }
      // A settings page that is already a tab needs no header button too (#77).
      hasSettings={
        app.admin.pages.some((p) => p.path === 'settings') &&
        !(tabs.length > 1 && tabs.some((t) => t.path === 'settings'))
      }
      tabs={tabs}
      active={match.page.path}
      headerAction={registered.HeaderAction ? <registered.HeaderAction /> : undefined}
    >
      <Page params={match.params} />
    </AppShell>
  )
}
