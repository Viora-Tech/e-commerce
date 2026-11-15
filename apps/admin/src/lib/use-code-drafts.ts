'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

/**
 * Customize's view of Edit code: how many files of an imported theme are saved but not
 * published, and Save as one step that commits the template drafts and publishes those files
 * together (one version history entry). Our own themes have no code drafts, so it stays 0.
 */
export function useCodeDrafts(themeId: string, imported: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!imported) return
    let current = true
    api.themes.code.counts({ themeId }).then(
      (c) => current && setCount(c.code),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [themeId, imported])

  /** Save: Customize's drafts saved and Edit code's unpublished files live, in one call. */
  const commit = async () => {
    const result = await api.themes.code.publishAll({ themeId })
    setCount(0)
    return result
  }

  return { count, commit }
}
