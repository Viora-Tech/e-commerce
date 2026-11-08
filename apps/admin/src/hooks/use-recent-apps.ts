'use client'

import { useEffect, useState } from 'react'
import { appIdFromPath, parseRecentApps, pushRecentApp, recentAppsKey } from '@/lib/recent-apps'

/**
 * The app ids this member opened most recently in this store, newest first, kept in this browser
 * (never sent anywhere). Opening any page under `/apps/<id>` of an installed app records it.
 * Storage can be blocked, so every read and write is guarded; the list then lasts for the visit.
 */
export function useRecentApps(
  storeId: string | null,
  pathname: string,
  installedIds: readonly string[],
): { recent: string[]; currentId: string | null } {
  // Hooks
  const [recent, setRecent] = useState<string[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Derived
  const pathId = appIdFromPath(pathname)
  const currentId = pathId && installedIds.includes(pathId) ? pathId : null

  useEffect(() => {
    if (!storeId) return
    let saved: string[] = []
    try {
      saved = parseRecentApps(localStorage.getItem(recentAppsKey(storeId)))
    } catch {
      // Private window or blocked storage: start empty.
    }
    setRecent(saved)
    setLoadedFor(storeId)
  }, [storeId])

  useEffect(() => {
    // Wait for the saved list, so recording the open app never overwrites it.
    if (!storeId || loadedFor !== storeId || !currentId || recent[0] === currentId) return
    const next = pushRecentApp(recent, currentId)
    setRecent(next)
    try {
      localStorage.setItem(recentAppsKey(storeId), JSON.stringify(next))
    } catch {
      // Not remembered this time; the sidebar still shows the open app.
    }
  }, [storeId, loadedFor, currentId, recent])

  return { recent, currentId }
}
