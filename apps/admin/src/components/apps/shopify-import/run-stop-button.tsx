'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { RunDetail } from './types'

type RunStopButtonProps = {
  run: RunDetail
  /** The run was stopped (waiting) or asked to stop (running); the page reloads it. */
  onStopped: () => void
}

/**
 * Stop import, on a waiting or running import, after a plain-words confirm. A
 * waiting one stops at once; a running one within seconds. What it imported stays.
 */
export default function RunStopButton({ run, onStopped }: RunStopButtonProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleStop = async () => {
    setBusy(true)
    try {
      const result = await api.shopifyImport.stop({ id: run.id })
      toast.success(result.status === 'cancelled' ? copy.stop.done : copy.stop.asked)
      onStopped()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.stop.failed)
      throw err
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (run.status !== 'queued' && run.status !== 'running') return null

  // Render logic
  const asked = Boolean(run.stopRequestedAt)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        onClick={() => setOpen(true)}
        disabled={busy || asked}
      >
        {busy || asked ? <Spinner /> : null}
        {copy.stop.button}
      </Button>
      <ConfirmDialog
        tone="destructive"
        open={open}
        onOpenChange={setOpen}
        title={copy.stop.title}
        body={copy.stop.body}
        confirmLabel={copy.stop.confirm}
        cancelLabel={copy.stop.keep}
        onConfirm={handleStop}
      />
    </>
  )
}
