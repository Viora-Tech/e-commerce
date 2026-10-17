import type { AccessLevel, AppSummary } from '@/components/apps/app-card'
import type { ChipTone } from '@/components/status/tone'
import type { installedAppsContent } from '@/data/installed-apps'
import { routes } from '@/lib/routes'

type Copy = typeof installedAppsContent

export type AppStatus = NonNullable<AppSummary['status']>

export const APP_STATUSES = ['connected', 'needsSetup', 'error'] as const satisfies AppStatus[]

export const STATUS_TONE: Record<AppStatus, ChipTone> = {
  connected: 'success',
  needsSetup: 'attention',
  error: 'danger',
}

/** A resource's name in the member's language; an unknown one shows as declared. */
export function resourceLabel(resource: string, copy: Copy): string {
  return copy.resources[resource] ?? resource
}

/** The app's overall level across what it declares: read only, write only, or both. */
export function overallLevel(app: AppSummary): AccessLevel | null {
  const levels = new Set(app.access.resources.map((r) => r.level))
  if (levels.size === 0) return null
  if (levels.has('read-write') || (levels.has('read') && levels.has('write'))) return 'read-write'
  return levels.has('write') ? 'write' : 'read'
}

/** "Orders, customers" for the Can access column (first three resources, order events last). */
export function accessNames(app: AppSummary, copy: Copy, limit = 3): string {
  const names = app.access.resources.slice(0, limit).map((r) => resourceLabel(r.resource, copy))
  return copy.joinResources(names)
}

/** "Read · makes invoices" under the names; "Read only" when an app only looks. */
export function accessDetail(app: AppSummary, copy: Copy): string {
  const level = overallLevel(app)
  const word =
    level === null
      ? ''
      : level === 'read' && !app.access.summary
        ? copy.readOnly
        : copy.levels[level]
  return word ? copy.accessLine(word, app.access.summary) : (app.access.summary ?? '')
}

/** Which settings page keeps the account of each kind of provider the app contributes. */
export function credentialKinds(app: AppSummary): (keyof Copy['sheet']['where'])[] {
  return (['payments', 'shipping', 'notifications', 'storage'] as const).filter(
    (k) => app.provides[k].length > 0,
  )
}

/** "Delhivery, Reviews and Back in stock" for the bulk confirm. */
export function namesSentence(names: string[], copy: Copy): string {
  if (names.length <= 1) return names[0] ?? ''
  return copy.confirmBulk.and(names.slice(0, -1).join(', '), names.at(-1) ?? '')
}

/** Count per status, for the tabs and the summary line. */
export function statusCounts(apps: AppSummary[]): Record<AppStatus, number> {
  const counts: Record<AppStatus, number> = { connected: 0, needsSetup: 0, error: 0 }
  for (const a of apps) if (a.status) counts[a.status] += 1
  return counts
}

/** Apps the Installed list shows: installed ones, without the always-on core plugin. */
export function installedApps(apps: AppSummary[]): AppSummary[] {
  return apps.filter((a) => a.installed && !a.builtIn)
}

const KIND_HREF: Record<'payments' | 'shipping' | 'notifications' | 'storage', string> = {
  payments: routes.settings.payments(),
  shipping: routes.settings.shipping(),
  notifications: routes.settings.notifications(),
  storage: routes.content.storage(),
}

const hasPage = (app: AppSummary, path: string) => app.admin.pages.some((p) => p.path === path)

/** Where "Open app" goes: the app's own screens, else the settings page of what it provides. */
export function openHref(app: AppSummary): string | null {
  if (app.admin.pages.length > 0) return routes.apps.page(app.id)
  const kind = credentialKinds(app)[0]
  return kind ? KIND_HREF[kind] : null
}

/** Where "Settings" goes: the app's Settings tab, else its Connect page, else where it opens. */
export function settingsHref(app: AppSummary): string | null {
  if (hasPage(app, 'settings')) return routes.apps.settings(app.id)
  if (hasPage(app, 'connect')) return routes.apps.connect(app.id)
  return openHref(app)
}

/** Where a merchant connects the app's account after installing. */
export function connectHref(app: AppSummary): string | null {
  return hasPage(app, 'connect') ? routes.apps.connect(app.id) : openHref(app)
}
