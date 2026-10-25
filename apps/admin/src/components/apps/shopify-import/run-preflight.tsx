'use client'

import type { ImportResource, PreflightCheck } from '@commerce/plugin-shopify-import/client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import PreflightCard from './preflight-card'

type RunPreflightProps = {
  resources: ImportResource[]
  mode: 'api' | 'csv'
}

/** "Before you import" on a finished preview, checked again just before Import now. */
export default function RunPreflight({ resources, mode }: RunPreflightProps) {
  // Hooks
  const [checks, setChecks] = useState<PreflightCheck[]>([])

  useEffect(() => {
    let live = true
    api.shopifyImport
      .preflight({ resources, mode })
      .then((next) => {
        if (live) setChecks(next)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [resources, mode])

  return <PreflightCard checks={checks} />
}
