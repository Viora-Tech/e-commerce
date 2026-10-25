'use client'

import { returnActions } from '@commerce/core/returns'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { returnListActionsContent } from '@/data/returns'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched } from '@/lib/run-batched'
import ReceiveDialog from './receive-dialog'
import RejectDialog from './reject-dialog'

type Item = Awaited<ReturnType<typeof api.returns.list>>['items'][number]

/** An action from the Returns list: a row's (one id) or the selection bar's. */
export type ReturnsListRequest = {
  kind: 'approve' | 'reject' | 'receive' | 'close'
  ids: string[]
  clear: () => void
}

type ReturnsListDialogsProps = {
  request: ReturnsListRequest | null
  /** The loaded rows: a selected return its status does not allow is skipped, not sent. */
  items: readonly Item[]
  onClose: () => void
  /** After the action ran: the list reads its rows again. */
  onDone: () => void
}

/** What a list row may do now, by the same rules as the return page's buttons. */
export function listActions(r: Item) {
  return returnActions({ ...r, restockedAt: null })
}

/**
 * The confirm steps for the Returns list: approve (pickup chosen later on the return page) and
 * close, for one row or the selection, plus the return page's own decline and "it arrived"
 * dialogs for one row. Rendered once by the page, outside the table.
 */
export default function ReturnsListDialogs({
  request,
  items,
  onClose,
  onDone,
}: ReturnsListDialogsProps) {
  // Hooks
  const copy = useCopy(returnListActionsContent)
  /* The store's "restock automatically" rule, the receive dialog's default; null while asked. */
  const [restock, setRestock] = useState<boolean | null>(null)

  useEffect(() => {
    if (request?.kind !== 'receive') return
    let live = true
    setRestock(null)
    api.returns
      .policy()
      .then((p) => live && setRestock(p.restockAutomatically))
      .catch(() => live && setRestock(false))
    return () => {
      live = false
    }
  }, [request])

  // Helpers
  const finish = () => {
    request?.clear()
    onDone()
  }

  // Event handlers
  const handleRun = async () => {
    if (!request) return
    const approving = request.kind === 'approve'
    const loaded = new Map(items.map((r) => [r.id, r]))
    const due = request.ids.filter((id) => {
      const r = loaded.get(id)
      if (!r) return false
      const can = listActions(r)
      return approving ? can.approve : can.resolve
    })
    const r = await runBatched(due, (id) =>
      approving
        ? api.returns.approve({ id, pickup: { method: 'later' } })
        : api.returns.close({ id }),
    )
    const summary = copy.summary(r.done, request.ids.length - due.length, r.failed)
    if (r.done > 0) toast.success(summary)
    else if (r.failed > 0) toast.error(summary)
    else toast.info(summary)
    finish()
  }

  // Render logic
  const n = request?.ids.length ?? 0
  const one = request?.ids[0] ?? ''
  const approving = request?.kind === 'approve'

  return (
    <>
      <ConfirmDialog
        open={approving || request?.kind === 'close'}
        onOpenChange={(o) => !o && onClose()}
        title={approving ? copy.approveTitle(n) : copy.closeTitle(n)}
        body={approving ? copy.approveBody : copy.closeBody}
        confirmLabel={approving ? copy.approve : copy.close}
        tone={approving ? 'default' : 'destructive'}
        onConfirm={handleRun}
      />
      <RejectDialog
        returnId={one}
        open={request?.kind === 'reject'}
        onClose={onClose}
        onDone={finish}
      />
      {request?.kind === 'receive' && restock !== null ? (
        <ReceiveDialog
          returnId={one}
          open
          restockByDefault={restock}
          onClose={onClose}
          onDone={finish}
        />
      ) : null}
    </>
  )
}
