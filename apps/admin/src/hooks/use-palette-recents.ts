'use client'

import { useEffect, useState } from 'react'
import { parseRecents, pushRecent, type RecentEntry } from '@/lib/palette-search'
import { scopedStorageKey, useStorageScope } from '@/lib/storage-scope'

/**
 * The member's last few opened pages and searches, kept in this browser per store and member (never sent
 * anywhere). Storage can be blocked, so every read and write is guarded and the palette works
 * without it.
 */
export function usePaletteRecents(): {
  recents: RecentEntry[]
  add: (entry: RecentEntry) => void
  clear: () => void
} {
  // Hooks
  const scope = useStorageScope()
  const key = scopedStorageKey('admin-palette-recents:v2', scope)
  const [recents, setRecents] = useState<RecentEntry[]>([])

  useEffect(() => {
    if (!key) {
      setRecents([])
      return
    }
    try {
      setRecents(parseRecents(localStorage.getItem(key)))
    } catch {
      setRecents([])
    }
  }, [key])

  // Helpers
  const save = (next: RecentEntry[]) => {
    setRecents(next)
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Private window or blocked storage: the list lasts until the palette closes.
    }
  }

  const add = (entry: RecentEntry) => save(pushRecent(recents, entry))

  const clear = () => save([])

  return { recents, add, clear }
}
