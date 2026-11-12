'use client'

import { useEffect, useState } from 'react'
import { appIdFromPath, parseRecentApps, pushRecentApp, RECENT_APPS_KEY } from '@/lib/recent-apps'
import { scopedStorageKey, useStorageScope } from '@/lib/storage-scope'

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
  const scope = useStorageScope()
  const [recent, setRecent] = useState<string[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Derived
  const pathId = appIdFromPath(pathname)
  const currentId = pathId && installedIds.includes(pathId) ? pathId : null
  const key =
    storeId && scope?.storeId === storeId ? scopedStorageKey(RECENT_APPS_KEY, scope) : null

  useEffect(() => {
    if (!key) return
    let saved: string[] = []
    try {
      saved = parseRecentApps(localStorage.getItem(key))
    } catch {
      // Private window or blocked storage: start empty.
    }
    setRecent(saved)
    setLoadedFor(key)
  }, [key])

  useEffect(() => {
    // Wait for the saved list, so recording the open app never overwrites it.
    if (!key || loadedFor !== key || !currentId || recent[0] === currentId) return
    const next = pushRecentApp(recent, currentId)
    setRecent(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Not remembered this time; the sidebar still shows the open app.
    }
  }, [key, loadedFor, currentId, recent])

  return { recent, currentId }
}
