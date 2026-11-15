'use client'

import type { CatalogueView } from '@commerce/core/automations'
import { useEffect, useState } from 'react'
import { type Loaded, useLoad } from '@/hooks/use-load'
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

/**
 * The catalogue as a `useLoad` read, for pages that cannot draw without it (the workflow editor,
 * a run): a failed read shows Try again instead of a skeleton forever.
 */
export function useAutomationCatalogueLoad(): Loaded<CatalogueView> {
  return useLoad(() => automationApi.catalogue())
}
