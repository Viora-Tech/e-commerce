'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmActionDialog from '@/components/inventory/confirm-action-dialog'
import NotesCard from '@/components/inventory/notes-card'
import ChargesCard from '@/components/landed-cost/charges-card'
import LandedCostCard from '@/components/landed-cost/landed-cost-card'
import type { CostPreview } from '@/components/landed-cost/types'
import PageColumns from '@/components/layout/page-columns'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import DocumentsCard from '@/components/purchase-documents/documents-card'
import { inboundShipmentFormContent, inboundShipmentsContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ShipmentDetailsCard, { type ShipmentDraft } from './shipment-details-card'
import ShipmentOrdersCard from './shipment-orders-card'

export type LoadedShipment = Awaited<ReturnType<typeof api.inboundShipments.get>>

type ShipmentFormProps = {
  shipment: LoadedShipment | null
  /** Charges and landed cost across its orders; null while creating. */
  costs: CostPreview | null
  /** Bills can be read with AI (Settings → AI, and this member's role). */
  aiReading: boolean
}

const day = (value: Date | string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : ''

function draftFrom(s: LoadedShipment | null): ShipmentDraft {
  return {
    reference: s?.reference ?? '',
    billOfEntryNo: s?.billOfEntryNo ?? '',
    billOfEntryDate: s?.billOfEntryDate ?? '',
    port: s?.port ?? '',
    arrivedAt: day(s?.arrivedAt ?? null),
    status: s?.status ?? 'in_transit',
    note: s?.note ?? '',
  }
}

const LIST = routes.stock.inboundShipments()

/** One import consignment: its details, the orders it carried, shared charges and landed cost. */
export default function ShipmentForm({ shipment, costs, aiReading }: ShipmentFormProps) {
  // Hooks
  const copy = useCopy(inboundShipmentFormContent)
  const listCopy = useCopy(inboundShipmentsContent)
  const router = useRouter()
  const [d, setD] = useState<ShipmentDraft>(() => draftFrom(shipment))
  const [saved, setSaved] = useState(() => JSON.stringify(draftFrom(shipment)))
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const patch = (next: Partial<ShipmentDraft>) => setD((prev) => ({ ...prev, ...next }))

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      const id = await api.inboundShipments.save({
        id: shipment?.id,
        reference: d.reference.trim() || undefined,
        billOfEntryNo: d.billOfEntryNo.trim() || undefined,
        billOfEntryDate: d.billOfEntryDate || null,
        port: d.port.trim() || undefined,
        arrivedAt: d.arrivedAt ? new Date(d.arrivedAt) : null,
        status: d.status,
        note: d.note.trim() || undefined,
      })
      setSaved(JSON.stringify(d))
      toast.success(shipment ? copy.saved : copy.created)
      if (shipment) router.refresh()
      else router.replace(routes.stock.inboundShipment(id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!shipment) return
    try {
      await api.inboundShipments.delete({ id: shipment.id })
      toast.success(copy.deleted)
      router.push(LIST)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  // Render logic
  const dirty = JSON.stringify(d) !== saved

  return (
    <ProoflyPageBody>
      <SaveBar
        open={dirty && shipment !== null}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => setD(JSON.parse(saved) as ShipmentDraft)}
        saving={busy}
      />
      <ProoflyPageHeader
        title={shipment ? copy.title(shipment.number) : copy.newTitle}
        summary={shipment ? listCopy.status[shipment.status] : undefined}
        back={{ label: copy.back, href: LIST }}
        actions={
          <>
            {shipment ? (
              <Button variant="outline" onClick={() => setDeleting(true)} disabled={busy}>
                {copy.delete}
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={busy}>
              {busy ? copy.saving : copy.save}
            </Button>
          </>
        }
      />
      <PageColumns
        main={
          <>
            <ShipmentDetailsCard draft={d} onChange={patch} />
            {shipment ? (
              <ShipmentOrdersCard
                shipmentId={shipment.id}
                orders={shipment.orders}
                onChanged={() => router.refresh()}
              />
            ) : (
              <p className="rounded-lg bg-primary-soft px-4 py-3 text-body text-ink-strong">
                {copy.saveFirst}
              </p>
            )}
            <ChargesCard
              costs={costs}
              owner={shipment ? { inboundShipmentId: shipment.id } : null}
              editable={shipment !== null}
              onChanged={() => router.refresh()}
            />
            {costs ? <LandedCostCard costs={costs} /> : null}
            <DocumentsCard
              owner={shipment ? { inboundShipmentId: shipment.id } : null}
              aiReading={aiReading}
              onApplied={() => router.refresh()}
            />
          </>
        }
        side={
          <NotesCard
            id="shipment-note"
            heading={copy.notes.heading}
            placeholder={copy.notes.placeholder}
            value={d.note}
            disabled={false}
            onChange={(note) => patch({ note })}
          />
        }
      />
      <ConfirmActionDialog
        open={deleting}
        onOpenChange={setDeleting}
        copy={copy.confirmDelete}
        destructive
        onConfirm={handleDelete}
      />
    </ProoflyPageBody>
  )
}
