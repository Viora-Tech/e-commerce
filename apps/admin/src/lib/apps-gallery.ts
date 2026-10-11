import type { AppSummary } from '@/components/apps/app-card'
import { type AppKind, appsContent } from '@/data/apps'
import { routes } from '@/lib/routes'

export type AppsGallery = {
  builtin: AppSummary[]
  connections: AppSummary[]
}

/**
 * Splits every plugin this deployment ships into the two Apps sections. The
 * implicit `core` plugin (COD, demo courier, log channel, local storage) is
 * not something a merchant installs or opens, so it never gets a card.
 */
export function groupApps(apps: AppSummary[]): AppsGallery {
  const installable = apps.filter((a) => a.id !== 'core')
  return {
    builtin: installable.filter((a) => a.kind === 'builtin'),
    connections: installable.filter((a) => a.kind === 'connection'),
  }
}

/** Category slugs present among a set of apps, in first-seen order. */
export function categoriesOf(apps: AppSummary[]): string[] {
  return [...new Set(apps.flatMap((a) => (a.category ? [a.category] : [])))]
}

/** True when `app`'s name or description contains `query` (case-insensitive; empty always matches). */
export function matchesQuery(app: AppSummary, query: string): boolean {
  if (!query) return true
  const needle = query.toLowerCase()
  return (
    app.name.toLowerCase().includes(needle) ||
    (app.description ?? '').toLowerCase().includes(needle)
  )
}

/**
 * The Connections grid after search and the category/installed filter chips.
 * `filter` is `'all'`, `'installed'`, or one of `categoriesOf`'s values.
 */
export function filterConnections(apps: AppSummary[], query: string, filter: string): AppSummary[] {
  return apps.filter((a) => {
    if (!matchesQuery(a, query)) return false
    if (filter === 'all') return true
    if (filter === 'installed') return a.installed
    return a.category === filter
  })
}

type AppEntry = Pick<AppSummary, 'id' | 'provides'> & { admin: { pages: unknown[] } }

/**
 * Where an installed app's sidebar entry goes: its own pages when it has any, otherwise the
 * settings page of the first kind it plugs into (e.g. a storage provider opens Files → Storage).
 */
export function appEntryHref(app: AppEntry): string {
  if (app.admin.pages.length > 0) return routes.apps.page(app.id)
  const kind = (Object.keys(appsContent.kinds) as AppKind[]).find((k) => app.provides[k].length > 0)
  return kind ? appsContent.kinds[kind].href : routes.apps.list()
}
