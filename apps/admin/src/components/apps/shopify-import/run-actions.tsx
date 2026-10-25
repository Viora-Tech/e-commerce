'use client'

import { ExternalLink, Eye, RotateCcw, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
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
 * What can happen next to a finished run, secondary first and primary last: Import now
 * after a preview, Try again after a failure, Run again after a stop, View store after
 * a clean import, and after an import with problems "Retry the N that were missed"
 * (only those) next to "Import everything again".
 */
export default function RunActions({ run, onQueued }: RunActionsProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const view = useCopy(shopifyImportRunContent)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [storeUrl, setStoreUrl] = useState<string | null>(null)

  useEffect(() => {
    if (run.status !== 'completed' || run.dryRun) return
    let live = true
    api.store
      .origin()
      .then((origin) => {
        if (live) setStoreUrl(origin)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [run.status, run.dryRun])

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

  const handlePreview = async () => {
    setBusy(true)
    try {
      const next = await api.shopifyImport.createApiRun({
        resources: run.resources,
        includeUnusedFiles: run.includeUnusedFiles,
      })
      router.push(`${base}/runs/${next.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : view.previewAgainFailed)
      setBusy(false)
    }
  }

  // Early returns
  if (run.status !== 'completed' && run.status !== 'failed' && run.status !== 'cancelled') {
    return null
  }

  // Render logic
  // A stopped import can be retried like a finished one: only what it missed.
  const clean = run.status === 'completed' && !run.dryRun
  const canRetry = run.status !== 'failed' && !run.dryRun && run.retryable > 0
  const canPreview = run.mode === 'api' && (run.dryRun || run.status === 'failed')
  const showStore = clean && !canRetry && storeUrl
  const label =
    run.status === 'failed' ? copy.tryAgain : run.dryRun ? copy.importNow : copy.runAgain

  return (
    <>
      {canPreview ? (
        <Button type="button" variant="outline" onClick={handlePreview} disabled={busy}>
          <Eye aria-hidden="true" />
          {view.previewAgain}
        </Button>
      ) : null}
      {canRetry && !run.retryOf ? (
        <Button type="button" variant="outline" onClick={handleStart} disabled={busy}>
          <Upload aria-hidden="true" />
          {copy.importAll}
        </Button>
      ) : null}
      {showStore ? (
        <Button type="button" variant="outline" onClick={handleStart} disabled={busy}>
          <RotateCcw aria-hidden="true" />
          {copy.runAgain}
        </Button>
      ) : null}
      {showStore ? (
        <Button
          nativeButton={false}
          render={<a href={storeUrl} target="_blank" rel="noreferrer" />}
        >
          {view.viewStore}
          <ExternalLink />
        </Button>
      ) : canRetry ? (
        <Button type="button" onClick={handleRetry} disabled={busy}>
          {busy ? <Spinner /> : <RotateCcw aria-hidden="true" />}
          {copy.retryMissed(run.retryable)}
        </Button>
      ) : (
        <Button type="button" onClick={handleStart} disabled={busy}>
          {busy ? <Spinner /> : null}
          {label}
        </Button>
      )}
    </>
  )
}
