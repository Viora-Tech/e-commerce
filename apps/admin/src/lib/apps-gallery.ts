import { type AppKind, appsContent } from '@/data/apps'
import type { AppSummary } from '@/lib/app-summary'
import { routes } from '@/lib/routes'

/** True when `app`'s name or description contains `query` (case-insensitive; empty always matches). */
export function matchesQuery(app: AppSummary, query: string): boolean {
  if (!query) return true
  const needle = query.toLowerCase()
  return (
    app.name.toLowerCase().includes(needle) ||
    (app.description ?? '').toLowerCase().includes(needle)
  )
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
