'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmActionDialog from '@/components/inventory/confirm-action-dialog'
import type { StoreLocation } from '@/components/inventory/location-select'
import NotesCard from '@/components/inventory/notes-card'
import PageColumns from '@/components/layout/page-columns'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import { purchaseOrderFormContent, purchaseOrdersContent } from '@/data/inventory'
import { api } from '@/lib/api-client'
import CostSummaryCard from './cost-summary-card'
import DestinationCard from './destination-card'
import {
  emptyPoForm,
  fromPurchaseOrder,
  type LoadedPurchaseOrder,
  type PoForm,
  toInput,
} from './form-state'
import PoActions from './po-actions'
import PoLinesCard from './po-lines-card'
import ReceiveDialog from './receive-dialog'
import SupplierCard from './supplier-card'

type PurchaseOrderFormProps = {
  po: LoadedPurchaseOrder | null
  locations: StoreLocation[]
}

type Dialog = 'receive' | 'close' | 'delete' | null

const copy = purchaseOrderFormContent
const LIST = '/products/purchase-orders'

function initialForm(po: LoadedPurchaseOrder | null, locations: StoreLocation[]): PoForm {
  if (po) return fromPurchaseOrder(po)
  const home = locations.find((l) => l.fulfilsOnlineOrders) ?? locations[0]
  return emptyPoForm(home?.id ?? '')
}

const message = (err: unknown) => (err instanceof Error ? err.message : copy.saveFailed)

/** Create or edit a purchase order, then order, receive and close it. */
export default function PurchaseOrderForm({ po, locations }: PurchaseOrderFormProps) {
  // Hooks
  const router = useRouter()
  const [form, setForm] = useState<PoForm>(() => initialForm(po, locations))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(po, locations)))
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  // Helpers
  const patch = (next: Partial<PoForm>) => setForm((f) => ({ ...f, ...next }))

  /** Saves the form; returns the order id, or null when it is not valid yet. */
  const persist = async (): Promise<string | null> => {
    if (form.supplierName.trim() === '') {
      toast.error(copy.needSupplier)
      return null
    }
    const id = await api.purchaseOrders.save(toInput(form, po?.id))
    setSaved(JSON.stringify(form))
    return id
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (err) {
      toast.error(message(err))
    } finally {
      setBusy(false)
    }
  }

  const reopen = (id: string) => (po ? router.refresh() : router.replace(`${LIST}/${id}`))

  // Event handlers
  const handleSave = () =>
    run(async () => {
      const id = await persist()
      if (!id) return
      toast.success(po ? copy.saved : copy.created)
      reopen(id)
    })

  const handleMarkOrdered = () =>
    run(async () => {
      if (form.lines.length === 0) {
        toast.error(copy.needLines)
        return
      }
      const id = await persist()
      if (!id) return
      await api.purchaseOrders.markOrdered({ id })
      toast.success(copy.ordered)
      reopen(id)
    })

  const handleClose = () =>
    run(async () => {
      if (!po) return
      await api.purchaseOrders.close({ id: po.id })
      toast.success(copy.closed)
      router.refresh()
    })

  const handleDelete = () =>
    run(async () => {
      if (!po) return
      await api.purchaseOrders.delete({ id: po.id })
      toast.success(copy.deleted)
      router.push(LIST)
    })

  const handleDiscard = () => setForm(JSON.parse(saved) as PoForm)

  // Render logic
  const status = po?.status ?? null
  const finished = status === 'received' || status === 'closed'
  const draft = status === null || status === 'draft'
  const dirty = JSON.stringify(form) !== saved

  return (
    <ProoflyPageBody>
      <SaveBar
        open={dirty && po !== null && !finished}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <ProoflyPageHeader
        title={po ? copy.title(po.number) : copy.newTitle}
        summary={status ? purchaseOrdersContent.status[status] : undefined}
        back={{ label: copy.back, href: LIST }}
        actions={
          <PoActions
            status={status}
            busy={busy}
            onSave={handleSave}
            onMarkOrdered={handleMarkOrdered}
            onReceive={() => setDialog('receive')}
            onClose={() => setDialog('close')}
            onDelete={() => setDialog('delete')}
          />
        }
      />
      {finished || !draft ? (
        <p className="rounded-lg bg-primary-soft px-4 py-3 text-body text-ink-strong">
          {finished ? copy.locked : copy.headerOnly}
        </p>
      ) : null}
      <PageColumns
        main={
          <>
            <SupplierCard
              name={form.supplierName}
              email={form.supplierEmail}
              phone={form.supplierPhone}
              disabled={finished}
              onChange={patch}
            />
            <PoLinesCard
              lines={form.lines}
              locationId={form.locationId}
              locked={!draft}
              showReceived={!draft}
              onChange={(lines) => patch({ lines })}
            />
          </>
        }
        side={
          <>
            <DestinationCard
              locations={locations}
              locationId={form.locationId}
              expectedAt={form.expectedAt}
              locationLocked={!draft}
              disabled={finished}
              onChange={patch}
            />
            <CostSummaryCard form={form} disabled={finished} onChange={patch} />
            <NotesCard
              id="po-note"
              heading={copy.notes.heading}
              placeholder={copy.notes.placeholder}
              value={form.note}
              disabled={finished}
              onChange={(note) => patch({ note })}
            />
          </>
        }
      />
      {po ? (
        <ReceiveDialog
          po={po}
          open={dialog === 'receive'}
          onOpenChange={(open) => setDialog(open ? 'receive' : null)}
          onReceived={() => router.refresh()}
        />
      ) : null}
      <ConfirmActionDialog
        open={dialog === 'close'}
        onOpenChange={(open) => setDialog(open ? 'close' : null)}
        copy={copy.confirmClose}
        onConfirm={handleClose}
      />
      <ConfirmActionDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        copy={copy.confirmDelete}
        destructive
        onConfirm={handleDelete}
      />
    </ProoflyPageBody>
  )
}
