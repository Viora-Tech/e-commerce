'use client'

import { cancelsWithoutRefund } from '@commerce/core/order-edit-rules'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import TagInput from '@/components/fields/tag-input'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { ordersContent } from '@/data/orders'
import { ordersBulkContent } from '@/data/orders-bulk'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { canRemindToPay } from '@/lib/order-next-move'
import { runBatched } from '@/lib/run-batched'

/** A bulk action from the orders list that asks first. */
export type OrdersBulkRequest = {
  kind: 'addTags' | 'removeTags' | 'remind' | 'cancel'
  ids: string[]
  clear: () => void
}

type OrdersBulkDialogsProps = {
  request: OrdersBulkRequest | null
  /** The loaded rows: orders on screen that cannot be reminded (or cancelled) are skipped without a call. */
  items: readonly {
    id: string
    status: string
    paymentStatus: string
    fulfillmentStatus: string
    importedFrom: string | null
    paymentMethod: string | null
    tags: string[] | null
  }[]
  /** Every tag used on the loaded orders, offered while adding. */
  tagSuggestions: readonly string[]
  onClose: () => void
  /** After the action ran: the list reads its rows again. */
  onDone: () => void
}

/** Most ids one `orders.tagMany` call takes (the API's BULK_MAX). */
const TAG_CHUNK = 200

/** The API refused this one order for a reason that is a skip, not a failure. */
function isSkip(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  // Reminded in the last 6 hours, or no longer waiting on a transfer (paid, cancelled, imported).
  return code === 'TOO_MANY_REQUESTS' || code === 'BAD_REQUEST'
}

/** The member's role sends cancels for approval: queued, not done and not failed. */
const isQueued = (err: unknown) => (err as { code?: unknown } | null)?.code === 'APPROVAL_QUEUED'

/**
 * The confirm steps for the orders list's bulk actions: add or remove tags (one dialog with
 * the tag field), send payment reminders, and cancel the orders that have nothing to refund. Rendered once by the page, outside the table,
 * so clicks inside never reach a row.
 */
export default function OrdersBulkDialogs({
  request,
  items,
  tagSuggestions,
  onClose,
  onDone,
}: OrdersBulkDialogsProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const bulkCopy = useCopy(ordersBulkContent)
  const [tags, setTags] = useState<string[]>([])
  const [restock, setRestock] = useState(true)
  const [notify, setNotify] = useState(true)

  // Helpers
  const finish = () => {
    request?.clear()
    setTags([])
    setRestock(true)
    setNotify(true)
    onDone()
  }
  /* Orders on screen that hold money are skipped without a call; the server checks every one. */
  const cancelPlan = (ids: readonly string[]) => {
    const loaded = new Map(items.map((o) => [o.id, o]))
    const due = ids.filter((id) => {
      const o = loaded.get(id)
      return !o || cancelsWithoutRefund(o)
    })
    return { due, skipped: ids.length - due.length }
  }

  // Event handlers
  const handleTags = async () => {
    if (!request || request.kind === 'remind') return
    const action = request.kind === 'addTags' ? 'add' : 'remove'
    try {
      let updated = 0
      for (let i = 0; i < request.ids.length; i += TAG_CHUNK) {
        const r = await api.orders.tagMany({
          ids: request.ids.slice(i, i + TAG_CHUNK),
          tags,
          action,
        })
        updated += r.updated
      }
      toast.success(bulkCopy.tagsDone(updated))
      finish()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
      throw err
    }
  }

  const handleRemind = async () => {
    if (!request) return
    const loaded = new Map(items.map((o) => [o.id, o]))
    const due = request.ids.filter((id) => {
      const o = loaded.get(id)
      return !o || canRemindToPay(o)
    })
    let skipped = request.ids.length - due.length
    let sent = 0
    const r = await runBatched(due, async (orderId) => {
      try {
        await api.orders.sendPaymentReminder({ orderId })
        sent += 1
      } catch (err) {
        if (!isSkip(err)) throw err
        skipped += 1
      }
    })
    const summary = bulkCopy.remindDone(sent, skipped, r.failed)
    if (sent > 0) toast.success(summary)
    else if (r.failed > 0) toast.error(summary)
    else toast.info(summary)
    finish()
  }

  /* The order page's own cancel (`orders.cancel`), with nothing refunded: no second path. */
  const handleCancel = async () => {
    if (!request) return
    const plan = cancelPlan(request.ids)
    let skipped = plan.skipped
    let cancelled = 0
    let queued = 0
    const r = await runBatched(plan.due, async (orderId) => {
      try {
        await api.orders.cancel({
          orderId,
          restock,
          notifyCustomer: notify,
          refund: 'none',
          onlyWithoutRefund: true,
        })
        cancelled += 1
      } catch (err) {
        if (isQueued(err)) queued += 1
        // Paid since the list loaded, shipped, or already cancelled: a skip, as on screen.
        else if (isSkip(err)) skipped += 1
        else throw err
      }
    })
    const summary = bulkCopy.cancelDone(cancelled, skipped, queued, r.failed)
    if (cancelled > 0 || queued > 0) toast.success(summary)
    else if (r.failed > 0) toast.error(summary)
    else toast.info(summary)
    finish()
  }

  const handleOpenChange = (open: boolean) => {
    if (open) return
    setTags([])
    setRestock(true)
    setNotify(true)
    onClose()
  }

  // Render logic
  const n = request?.ids.length ?? 0
  const tagging = request?.kind === 'addTags' || request?.kind === 'removeTags'
  const cancelling = request?.kind === 'cancel'
  const toCancel = cancelling ? cancelPlan(request.ids) : { due: [], skipped: 0 }
  const selected = new Set(request?.ids ?? [])
  /* Removing offers the tags the selected orders on screen carry. */
  const onSelected = [
    ...new Set(items.filter((o) => selected.has(o.id)).flatMap((o) => o.tags ?? [])),
  ]

  return (
    <>
      <ConfirmDialog
        open={tagging}
        onOpenChange={handleOpenChange}
        title={
          request?.kind === 'removeTags' ? bulkCopy.removeTagsTitle(n) : bulkCopy.addTagsTitle(n)
        }
        body={copy.row.tagsBody}
        confirmLabel={copy.row.tagsSave}
        cancelLabel={copy.row.tagsCancel}
        tone="default"
        confirmDisabled={tags.length === 0}
        onConfirm={handleTags}
      >
        <TagInput
          id="orders-bulk-tags"
          tags={tags}
          suggestions={request?.kind === 'removeTags' ? onSelected : tagSuggestions}
          onChange={setTags}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={request?.kind === 'remind'}
        onOpenChange={handleOpenChange}
        title={bulkCopy.remindTitle(n)}
        body={bulkCopy.remindBody}
        confirmLabel={bulkCopy.remindConfirm}
        tone="default"
        onConfirm={handleRemind}
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={handleOpenChange}
        title={bulkCopy.cancelTitle(toCancel.due.length)}
        body={
          toCancel.skipped > 0 ? bulkCopy.cancelBodySkipping(toCancel.skipped) : bulkCopy.cancelBody
        }
        confirmLabel={bulkCopy.cancelConfirm}
        cancelLabel={bulkCopy.cancelKeep}
        confirmDisabled={toCancel.due.length === 0}
        onConfirm={handleCancel}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="orders-bulk-restock" className="flex items-center gap-2 font-normal">
            <Checkbox
              id="orders-bulk-restock"
              checked={restock}
              onCheckedChange={(v) => setRestock(v === true)}
            />
            {bulkCopy.cancelRestock}
          </Label>
          <Label htmlFor="orders-bulk-notify" className="flex items-center gap-2 font-normal">
            <Checkbox
              id="orders-bulk-notify"
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
            />
            {bulkCopy.cancelNotify}
          </Label>
        </div>
      </ConfirmDialog>
    </>
  )
}
