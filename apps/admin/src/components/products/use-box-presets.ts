'use client'

import type { BoxPreset } from '@commerce/core'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

/** The store's box presets, loaded when `enabled` turns true; empty until then or on error. */
export function useBoxPresets(enabled: boolean): BoxPreset[] {
  const [boxes, setBoxes] = useState<BoxPreset[]>([])

  useEffect(() => {
    if (!enabled) return
    api.store
      .getShipping()
      .then((r) => setBoxes(r.settings.boxPresets ?? []))
      .catch(() => setBoxes([]))
  }, [enabled])

  return boxes
}
