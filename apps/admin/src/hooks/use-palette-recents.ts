'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { parseRecents, pushRecent, type RecentEntry } from '@/lib/palette-search'

const storageKey = (userId: string) => `admin-palette-recents:v1:${userId}`

/**
 * The member's last few opened pages and searches, kept in this browser per member (never sent
 * anywhere). Storage can be blocked, so every read and write is guarded and the palette works
 * without it.
 */
export function usePaletteRecents(): {
  recents: RecentEntry[]
  add: (entry: RecentEntry) => void
  clear: () => void
} {
  // Hooks
  const { member } = usePermissions()
  const userId = member?.userId ?? null
  const [recents, setRecents] = useState<RecentEntry[]>([])

  useEffect(() => {
    if (!userId) return
    try {
      setRecents(parseRecents(localStorage.getItem(storageKey(userId))))
    } catch {
      setRecents([])
    }
  }, [userId])

  // Helpers
  const save = (next: RecentEntry[]) => {
    setRecents(next)
    if (!userId) return
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next))
    } catch {
      // Private window or blocked storage: the list lasts until the palette closes.
    }
  }

  const add = (entry: RecentEntry) => save(pushRecent(recents, entry))

  const clear = () => save([])

  return { recents, add, clear }
}
