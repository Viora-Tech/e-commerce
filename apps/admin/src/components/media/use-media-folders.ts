import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

export type MediaFolder = Awaited<ReturnType<typeof api.media.folders>>[number]

/**
 * The store's Files folders (#91), loaded once `enabled` and again on `reload` (after a folder
 * is made, renamed or deleted, or files move). A failed read leaves the list empty: folders
 * help browsing, they never block it.
 */
export function useMediaFolders(enabled = true) {
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [revision, setRevision] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` re-runs the load after a change
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api.media
      .folders()
      .then((rows) => !cancelled && setFolders(rows))
      .catch(() => !cancelled && setFolders([]))
    return () => {
      cancelled = true
    }
  }, [enabled, revision])

  const reload = () => setRevision((n) => n + 1)

  return { folders, reload }
}
