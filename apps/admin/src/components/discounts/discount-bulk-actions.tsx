'use client'

import { Pause, Play, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { discountsContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched } from '@/lib/run-batched'

type DiscountBulkActionsProps = {
  ids: string[]
  clear: () => void
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

type Action = 'pause' | 'resume' | 'delete'

/** Pause, resume or delete the selected discounts, one call each, ten at a time. */
export default function DiscountBulkActions({ ids, clear, onChanged }: DiscountBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(discountsContent)
  const [confirm, setConfirm] = useState<Action | null>(null)

  // Event handlers
  const handleConfirm = async () => {
    const action = confirm
    if (!action) return
    const { done, failed } = await runBatched<unknown>(ids, (id) =>
      action === 'delete'
        ? api.discounts.delete({ id })
        : api.discounts.toggle({ id, status: action === 'pause' ? 'disabled' : 'active' }),
    )
    const message =
      action === 'pause'
        ? copy.paused(done)
        : action === 'resume'
          ? copy.resumed(done)
          : copy.deleted(done)
    if (failed === 0) toast.success(message)
    else toast.warning(`${message} · ${copy.failed(failed)}`)
    clear()
    onChanged()
  }

  // Render logic
  const dialog =
    confirm === 'pause'
      ? { title: copy.pauseTitle(ids.length), body: copy.pauseBody, label: copy.pauseConfirm }
      : confirm === 'resume'
        ? { title: copy.resumeTitle(ids.length), body: copy.resumeBody, label: copy.resumeConfirm }
        : { title: copy.deleteTitle(ids.length), body: copy.deleteBody, label: copy.deleteConfirm }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirm('pause')}>
        <Pause aria-hidden="true" />
        {copy.pause}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirm('resume')}>
        <Play aria-hidden="true" />
        {copy.resume}
      </Button>
      <Button variant="destructive" size="sm" onClick={() => setConfirm('delete')}>
        <Trash2 aria-hidden />
        {copy.delete}
      </Button>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={dialog.title}
        body={dialog.body}
        confirmLabel={dialog.label}
        cancelLabel={copy.cancel}
        tone={confirm === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirm}
      />
    </>
  )
}
