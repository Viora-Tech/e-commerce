import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ADMIN_APPS, matchAppPage } from '@/apps/registry'
import AppListing from '@/components/apps/app-listing'
import AppShell from '@/components/apps/app-shell'
import PageBody from '@/components/layout/page-body'
import { routes } from '@/lib/routes'
import { listAppBars, listApps } from '@/lib/shell-data'
import { orNoStore } from '@/lib/store-guard'

type Params = { params: Promise<{ pluginId: string; path?: string[] }> }

/** The tab reads the app's name, with the page's tab label after the first page. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pluginId, path = [] } = await params
  // The layout's `store.shell` read (one call per request, shared with the layout and the page).
  const apps = await listApps().catch(() => [])
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
  const [apps, bars] = await Promise.all([listApps().catch(orNoStore(undefined)), listAppBars()])
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
      statusPill={bars[app.id]?.statusPill ?? null}
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
      // The "…" menu's Settings item: the app's own settings page, when it has one.
      hasSettings={app.admin.pages.some((p) => p.path === 'settings')}
      tabs={tabs}
      active={match.page.path}
      headerAction={registered.HeaderAction ? <registered.HeaderAction /> : undefined}
    >
      <Page params={match.params} />
    </AppShell>
  )
}
