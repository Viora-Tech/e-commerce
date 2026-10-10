'use client'

import {
  PURCHASE_CURRENCY_CODES,
  type PurchaseCurrency,
  remainingOf,
} from '@commerce/core/inventory'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmActionDialog from '@/components/inventory/confirm-action-dialog'
import type { StoreLocation } from '@/components/inventory/location-select'
import NotesCard from '@/components/inventory/notes-card'
import ChargesCard from '@/components/landed-cost/charges-card'
import LandedCostCard from '@/components/landed-cost/landed-cost-card'
import type { CostPreview } from '@/components/landed-cost/types'
import PageColumns from '@/components/layout/page-columns'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import DocumentsCard from '@/components/purchase-documents/documents-card'
import type { PickedSupplier } from '@/components/suppliers/new-supplier-dialog'
import { purchaseOrderFormContent, purchaseOrdersContent } from '@/data/inventory'
import { poCurrencyContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CostSummaryCard from './cost-summary-card'
import CurrencyCard from './currency-card'
import DestinationCard from './destination-card'
import {
  emptyPoForm,
  formProblem,
  fromPurchaseOrder,
  type LoadedPurchaseOrder,
  type PoForm,
  toInput,
} from './form-state'
import PoActions from './po-actions'
import PoLinesCard from './po-lines-card'
import ReceiveDialog from './receive-dialog'
import ShipmentLinkCard from './shipment-link-card'
import SupplierCard from './supplier-card'

type PurchaseOrderFormProps = {
  po: LoadedPurchaseOrder | null
  locations: StoreLocation[]
  /** Charges and landed cost of the saved order (and its shipment); null while creating. */
  costs: CostPreview | null
  /** Bills can be read with AI (Settings → AI, and this member's role). */
  aiReading: boolean
}

type Dialog = 'receive' | 'close' | 'cancel' | 'delete' | null

const copy = purchaseOrderFormContent
const LIST = routes.stock.purchaseOrders()

function initialForm(po: LoadedPurchaseOrder | null, locations: StoreLocation[]): PoForm {
  if (po) return fromPurchaseOrder(po)
  const home = locations.find((l) => l.fulfilsOnlineOrders) ?? locations[0]
  return emptyPoForm(home?.id ?? '')
}

const message = (err: unknown) => (err instanceof Error ? err.message : copy.saveFailed)

const isPurchaseCurrency = (c: string): c is PurchaseCurrency =>
  (PURCHASE_CURRENCY_CODES as string[]).includes(c)

/** Create or edit a purchase order, add its charges, then order, receive, close or cancel it. */
export default function PurchaseOrderForm({
  po,
  locations,
  costs,
  aiReading,
}: PurchaseOrderFormProps) {
  // Hooks
  const router = useRouter()
  const currencyCopy = useCopy(poCurrencyContent)
  const [form, setForm] = useState<PoForm>(() => initialForm(po, locations))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(po, locations)))
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  // Helpers
  const patch = (next: Partial<PoForm>) => setForm((f) => ({ ...f, ...next }))

  /**
   * Saves the form; returns the order id, or null when it is not valid yet. With
   * `order` the draft is also sent to the supplier in the same request, so a failure
   * leaves nothing half done and a retry cannot create a second draft.
   */
  const persist = async (order = false): Promise<string | null> => {
    if (form.supplierName.trim() === '') {
      toast.error(copy.needSupplier)
      return null
    }
    const problem = formProblem(form)
    if (problem) {
      toast.error(problem === 'rate' ? currencyCopy.badRate : currencyCopy.badPrice)
      return null
    }
    const id = await api.purchaseOrders.save(toInput(form, po?.id, order))
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

  const reopen = (id: string) =>
    po ? router.refresh() : router.replace(routes.stock.purchaseOrder(id))

  const act = (call: (id: string) => Promise<unknown>, done: string) =>
    run(async () => {
      if (!po) return
      await call(po.id)
      toast.success(done)
      router.refresh()
    })

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
      const id = await persist(true)
      if (!id) return
      toast.success(copy.ordered)
      reopen(id)
    })

  const handlePickSupplier = (s: PickedSupplier) => {
    const draft = !po || po.status === 'draft'
    const currency = draft && isPurchaseCurrency(s.currency) ? s.currency : form.currency
    patch({
      supplierId: s.id,
      supplierName: s.name,
      supplierEmail: s.email ?? '',
      supplierPhone: s.phone ?? '',
      currency,
      fxRate: currency === form.currency ? form.fxRate : currency === 'INR' ? '1' : '',
    })
  }

  const handleClose = () => act((id) => api.purchaseOrders.close({ id }), copy.closed)
  const handleCancel = () => act((id) => api.purchaseOrders.cancel({ id }), copy.cancelled)
  const handleReopen = () => act((id) => api.purchaseOrders.reopen({ id }), copy.reopened)

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
  const finished = status === 'received' || status === 'closed' || status === 'cancelled'
  const draft = status === null || status === 'draft'
  const dirty = JSON.stringify(form) !== saved
  const nothingArrived = (po?.lines ?? []).every((l) => l.received + l.rejected === 0)
  const outstanding = (po?.lines ?? []).some((l) => remainingOf(l) > 0)

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
            cancellable={status === 'ordered' && nothingArrived}
            reopenable={status === 'cancelled' || (status === 'closed' && outstanding)}
            onSave={handleSave}
            onMarkOrdered={handleMarkOrdered}
            onReceive={() => setDialog('receive')}
            onClose={() => setDialog('close')}
            onCancel={() => setDialog('cancel')}
            onReopen={handleReopen}
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
              supplierId={form.supplierId}
              name={form.supplierName}
              email={form.supplierEmail}
              phone={form.supplierPhone}
              disabled={finished}
              onChange={patch}
              onPick={handlePickSupplier}
            />
            <PoLinesCard
              lines={form.lines}
              locationId={form.locationId}
              currency={form.currency}
              locked={!draft}
              hsnLocked={finished}
              showReceived={!draft}
              onChange={(lines) => patch({ lines })}
            />
            <ChargesCard
              costs={costs}
              owner={po ? { purchaseOrderId: po.id } : null}
              editable={po !== null && status !== 'cancelled'}
              shipmentNumber={po?.shipment?.number ?? null}
              onChanged={() => router.refresh()}
            />
            {po && costs ? <LandedCostCard costs={costs} purchaseOrderId={po.id} /> : null}
            <DocumentsCard
              owner={po ? { purchaseOrderId: po.id } : null}
              aiReading={aiReading}
              onApplied={() => router.refresh()}
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
            <CurrencyCard
              currency={form.currency}
              fxRate={form.fxRate}
              currencyLocked={!draft}
              disabled={finished}
              onChange={patch}
            />
            {po ? <ShipmentLinkCard shipment={po.shipment} /> : null}
            <CostSummaryCard form={form} chargesPaise={po?.totals.chargesPaise ?? 0} />
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
          costs={costs}
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
        open={dialog === 'cancel'}
        onOpenChange={(open) => setDialog(open ? 'cancel' : null)}
        copy={copy.confirmCancel}
        destructive
        onConfirm={handleCancel}
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
