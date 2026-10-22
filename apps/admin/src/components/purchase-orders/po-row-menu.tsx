'use client'

import { CancelCircle, CircleCheck, Download, PackageCheck, Send, Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { type PurchaseOrderStatus, purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import EmailPoDialog, { type EmailPoRequest } from './email-po-dialog'

type PoRowMenuProps = {
  po: { id: string; status: PurchaseOrderStatus; units: number; receivedUnits: number }
  /** The list re-reads its rows (and tab counts) after a change here. */
  onChanged: () => void
}

type Confirm = 'close' | 'cancel' | 'delete'
type DialogCopy = { title: string; body: string; confirm: string; cancel: string }

/** The "Are you sure?" words for each move, the same as on the purchase order page. */
const DIALOGS: Record<Confirm, (copy: typeof purchaseOrderFormContent) => DialogCopy> = {
  close: (copy) => copy.confirmClose,
  cancel: (copy) => copy.confirmCancel,
  delete: (copy) => copy.confirmDelete,
}

/**
 * The ⋯ menu on a purchase order row: the saved order's PDF and email, plus the stage moves
 * its page offers (mark ordered, cancel or close, delete), each only where it is allowed.
 */
export default function PoRowMenu({ po, onChanged }: PoRowMenuProps) {
  // Hooks
  const copy = useCopy(purchaseOrderFormContent)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  /** The supplier address to prefill, once the order was read; null while the dialog is shut. */
  const [emailTo, setEmailTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const act = (call: () => Promise<unknown>, done: string) =>
    run(async () => {
      await call()
      toast.success(done)
      onChanged()
    })

  // Event handlers
  const handleDownload = () =>
    run(async () => saveFile(await api.purchaseOrders.pdf({ id: po.id }), 'download'))

  const handleOpenEmail = () =>
    run(async () => {
      const full = await api.purchaseOrders.get({ id: po.id })
      setEmailTo(full.supplierEmail ?? '')
    })

  const handleEmail = (request: EmailPoRequest) =>
    run(async () => {
      const r = await api.purchaseOrders.email({ id: po.id, ...request })
      toast.success(r.markedOrdered ? copy.email.sentOrdered(r.to) : copy.email.sent(r.to))
      setEmailTo(null)
      onChanged()
    })

  const handleConfirm = () => {
    if (confirm === 'close') return act(() => api.purchaseOrders.close({ id: po.id }), copy.closed)
    if (confirm === 'cancel')
      return act(() => api.purchaseOrders.cancel({ id: po.id }), copy.cancelled)
    return act(() => api.purchaseOrders.delete({ id: po.id }), copy.deleted)
  }

  // Render logic
  const { status } = po
  const open = status === 'ordered' || status === 'partially_received'
  const nothingArrived = po.receivedUnits === 0
  const dialog = confirm === null ? null : DIALOGS[confirm](copy)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's own click; the controls inside are buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, keyboard events stop at the trigger.
    <span className="flex items-center" onClick={(event) => event.stopPropagation()}>
      <RowMenu
        items={[
          {
            label: copy.emailSupplier,
            icon: Send,
            disabled: busy,
            hidden: status === 'cancelled',
            onSelect: handleOpenEmail,
          },
          {
            label: copy.download,
            icon: Download,
            disabled: busy,
            hidden: status === 'cancelled',
            onSelect: handleDownload,
          },
          {
            label: copy.markOrdered,
            icon: PackageCheck,
            separatorBefore: true,
            disabled: busy,
            hidden: status !== 'draft' || po.units === 0,
            onSelect: () => act(() => api.purchaseOrders.markOrdered({ id: po.id }), copy.ordered),
          },
          {
            label: copy.close,
            icon: CircleCheck,
            separatorBefore: true,
            hidden: !open || nothingArrived,
            onSelect: () => setConfirm('close'),
          },
          {
            label: copy.cancel,
            icon: CancelCircle,
            destructive: true,
            hidden: !open || !nothingArrived,
            onSelect: () => setConfirm('cancel'),
          },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            hidden: status !== 'draft' && status !== 'cancelled',
            onSelect: () => setConfirm('delete'),
          },
        ]}
      />
      {dialog ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setConfirm(null)}
          title={dialog.title}
          body={dialog.body}
          confirmLabel={dialog.confirm}
          cancelLabel={dialog.cancel}
          tone={confirm === 'close' ? 'default' : 'destructive'}
          stopPropagation
          onConfirm={handleConfirm}
        />
      ) : null}
      <EmailPoDialog
        open={emailTo !== null}
        onOpenChange={(next) => !next && setEmailTo(null)}
        defaultTo={emailTo ?? ''}
        draft={status === 'draft'}
        busy={busy}
        onSend={handleEmail}
      />
    </span>
  )
}
