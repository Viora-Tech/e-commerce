/**
 * The sidebar's Apps list: the few apps this member opened most recently in this store, kept in
 * this browser (localStorage). A convenience only, so parsing is defensive and every helper here
 * is pure; the hook `use-recent-apps` does the storage reads and writes.
 */

/** How many apps the sidebar lists under Apps before "View all apps". */
export const SIDEBAR_RECENT_APPS = 3

/** How many app ids are remembered, so an app dropped from the top few can climb back. */
export const RECENT_APPS_MAX = 10

/** The storage key: one list per store, so switching stores never mixes their apps. */
export const recentAppsKey = (storeId: string) => `admin-recent-apps:v1:${storeId}`

/** The app id in an `/apps/<id>/...` path, or null on any other page. */
export function appIdFromPath(pathname: string): string | null {
  const match = /^\/apps\/([^/?#]+)/.exec(pathname)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/** The recent list after opening `appId`: newest first, one entry per app, capped. */
export function pushRecentApp(
  list: readonly string[],
  appId: string,
  max = RECENT_APPS_MAX,
): string[] {
  return [appId, ...list.filter((id) => id !== appId)].slice(0, max)
}

/** The saved list, or an empty one when it is missing or not a list of ids. */
export function parseRecentApps(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.filter((id): id is string => typeof id === 'string').slice(0, RECENT_APPS_MAX)
  } catch {
    return []
  }
}

/**
 * The apps to list in the sidebar, in order: the one on screen first, then the most recently
 * opened, then the rest in installed order to fill the gaps (so with no history it is simply the
 * first few installed apps). Ids that are no longer installed are skipped.
 */
export function orderSidebarApps<T extends { id: string }>(
  apps: readonly T[],
  recent: readonly string[],
  currentId: string | null,
  limit = SIDEBAR_RECENT_APPS,
): T[] {
  const byId = new Map(apps.map((a) => [a.id, a]))
  const ids = [...(currentId ? [currentId] : []), ...recent, ...apps.map((a) => a.id)]
  const seen = new Set<string>()
  const shown: T[] = []
  for (const id of ids) {
    const app = byId.get(id)
    if (!app || seen.has(id)) continue
    seen.add(id)
    shown.push(app)
    if (shown.length >= limit) break
  }
  return shown
}
