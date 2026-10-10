'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

let cached: Promise<boolean> | null = null

/** One request per page load; any failure just means "off", so Ask AI hides. */
function load(): Promise<boolean> {
  cached ??= api.ai
    .status()
    .then((status) => status.assistant)
    .catch(() => {
      cached = null
      return false
    })
  return cached
}

/** Whether the AI assistant is on for this store and member (the same flag Home reads). */
export function useAssistantEnabled(): boolean {
  // Hooks
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let live = true
    load().then((value) => {
      if (live) setEnabled(value)
    })
    return () => {
      live = false
    }
  }, [])

  return enabled
}
