'use client'

import type { ImportResource, PreflightCheck } from '@commerce/plugin-shopify-import/client'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import PreflightCard from './preflight-card'

type RunPreflightProps = {
  resources: ImportResource[]
  mode: 'api' | 'csv'
}

/** "Before you import" on a finished preview, checked again just before Import now. */
export default function RunPreflight({ resources, mode }: RunPreflightProps) {
  // Hooks
  // A failed check lists nothing, as before the answer.
  const { data } = useLoad(
    () => api.shopifyImport.preflight({ resources, mode }),
    [resources, mode],
  )
  const checks: PreflightCheck[] = data ?? []

  return <PreflightCard checks={checks} />
}
