'use client'

import type { CatalogueView } from '@commerce/core/automations'
import { useEffect, useState } from 'react'
import { automationApi } from '@/lib/automation-api'

/** The triggers, actions and fields this store can use in Automations; null while loading. */
export function useAutomationCatalogue(): CatalogueView | null {
  const [catalogue, setCatalogue] = useState<CatalogueView | null>(null)
  useEffect(() => {
    let live = true
    automationApi
      .catalogue()
      .then((c) => live && setCatalogue(c))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return catalogue
}
