'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { RunDetail } from './types'

type RunActionsProps = {
  run: RunDetail
  /** The run was queued again (Import now, Run again, Try again). */
  onQueued: () => void
}

const base = shopifyImportContent.base

/**
 * What can happen next to a finished run: Import now after a preview, Try again
 * after a failure, and after an import with problems "Retry the N that were
 * missed" (only those) next to "Import everything again".
 */
export default function RunActions({ run, onQueued }: RunActionsProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleStart = async () => {
    setBusy(true)
    try {
      await api.shopifyImport.start({ id: run.id })
      toast.success(copy.started)
      onQueued()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.startFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleRetry = async () => {
    setBusy(true)
    try {
      const next = await api.shopifyImport.retryRun({ id: run.id })
      toast.success(copy.started)
      router.push(`${base}/runs/${next.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.retryFailed)
      setBusy(false)
    }
  }

  // Early returns
  if (run.status !== 'completed' && run.status !== 'failed') return null

  // Render logic
  const canRetry = run.status === 'completed' && !run.dryRun && run.retryable > 0
  const label =
    run.status === 'failed' ? copy.tryAgain : run.dryRun ? copy.importNow : copy.runAgain

  return (
    <div className="flex flex-wrap gap-2">
      {canRetry && !run.retryOf ? (
        <Button type="button" variant="outline" onClick={handleStart} disabled={busy}>
          {copy.importAll}
        </Button>
      ) : null}
      {canRetry ? (
        <Button type="button" onClick={handleRetry} disabled={busy}>
          {busy ? <Spinner /> : null}
          {copy.retryMissed(run.retryable)}
        </Button>
      ) : (
        <Button type="button" onClick={handleStart} disabled={busy}>
          {busy ? <Spinner /> : null}
          {label}
        </Button>
      )}
    </div>
  )
}
