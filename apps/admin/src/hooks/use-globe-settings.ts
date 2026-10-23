'use client'

import { useEffect, useState } from 'react'
import {
  defaultGlobeSettings,
  type GlobeSettings,
  loadGlobeSettings,
  saveGlobeSettings,
} from '@/components/analytics/live-globe/globe-settings'

/**
 * The Live view globe's per-person settings: starts from the safe, SSR-identical defaults
 * (reduced motion assumed off) so the first paint never mismatches, then reads localStorage
 * once mounted (this is also where "reduced motion turns auto-rotate off by default" actually
 * takes effect, since that needs the browser's media query). Every change is saved immediately.
 */
export function useGlobeSettings(prefersReducedMotion: boolean) {
  // Hooks
  const [settings, setSettings] = useState(() => defaultGlobeSettings(false))

  // biome-ignore lint/correctness/useExhaustiveDependencies: only on mount, so a later reduced-motion change never overrides what the person already chose in the panel.
  useEffect(() => {
    setSettings(loadGlobeSettings(prefersReducedMotion))
  }, [])

  // Helpers
  const update = (patch: Partial<GlobeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveGlobeSettings(next)
      return next
    })
  }
  const reset = () => {
    const next = defaultGlobeSettings(prefersReducedMotion)
    saveGlobeSettings(next, { replaceZoom: true })
    setSettings(next)
  }

  return { settings, update, reset }
}
