'use client'

import { INBOUND_CARRIERS, type InboundCarrier, isInboundCarrier } from '@commerce/core/inventory'
import { PackageCheck, Save, Trash2, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import NotesCard from '@/components/inventory/notes-card'
import ChargesCard from '@/components/landed-cost/charges-card'
import LandedCostCard from '@/components/landed-cost/landed-cost-card'
import type { CostPreview } from '@/components/landed-cost/types'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import NoticeBar from '@/components/layout/notice-bar'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import SaveBar from '@/components/layout/save-bar'
import OrderChip from '@/components/orders/order-chip'
import DocumentsCard from '@/components/purchase-documents/documents-card'
import { inboundShipmentFormContent } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import MarkDeliveredDialog from './mark-delivered-dialog'
import ShipmentDetailsCard, { type ShipmentDraft } from './shipment-details-card'
import ShipmentGlanceCard from './shipment-glance-card'
import ShipmentOrdersCard from './shipment-orders-card'
import ShipmentTrackingCard from './shipment-tracking-card'

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
    carrier: (s?.carrier as InboundCarrier | null | undefined) ?? null,
    trackingNumber: s?.trackingNumber ?? '',
    trackingUrl: s?.trackingUrl ?? '',
    expectedAt: s?.expectedAt ?? '',
    reference: s?.reference ?? '',
    billOfEntryNo: s?.billOfEntryNo ?? '',
    billOfEntryDate: s?.billOfEntryDate ?? '',
    port: s?.port ?? '',
    arrivedAt: day(s?.arrivedAt ?? null),
    status: s?.status ?? 'planned',
    note: s?.note ?? '',
  }
}

const LIST = routes.stock.inboundShipments()

/** One import consignment: its details, the orders it carried, shared charges and landed cost. */
export default function ShipmentForm({ shipment, costs, aiReading }: ShipmentFormProps) {
  // Hooks
  const copy = useCopy(inboundShipmentFormContent)
  const fmt = useFormat()
  const router = useRouter()
  const [d, setD] = useState<ShipmentDraft>(() => draftFrom(shipment))
  const [saved, setSaved] = useState(() => JSON.stringify(draftFrom(shipment)))
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delivering, setDelivering] = useState<string | null>(null)
  const [tracking, setTracking] = useState(false)

  // Helpers
  const patch = (next: Partial<ShipmentDraft>) => setD((prev) => ({ ...prev, ...next }))

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      const id = await api.inboundShipments.save({
        id: shipment?.id,
        carrier: d.carrier,
        trackingNumber: d.trackingNumber.trim() || undefined,
        trackingUrl: d.trackingUrl.trim(),
        expectedAt: d.expectedAt || null,
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

  const handleTrack = async () => {
    if (!shipment) return
    setTracking(true)
    try {
      const r = await api.inboundShipments.track({ id: shipment.id })
      if (r.ok) {
        toast.success(
          r.expectedAt ? copy.tracking.updated(fmt.date(r.expectedAt)) : copy.tracking.noDate,
        )
        router.refresh()
      } else if (r.reason === 'not_connected') {
        const carrier =
          r.carrier && isInboundCarrier(r.carrier) ? INBOUND_CARRIERS[r.carrier].label : ''
        toast.error(copy.tracking.notConnected(carrier))
      } else {
        toast.error(copy.tracking.failed)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.tracking.failed)
    } finally {
      setTracking(false)
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
  const hasOrders = (shipment?.orders.length ?? 0) > 0

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
      <PageHeader
        title={shipment ? copy.title(shipment.number) : copy.newTitle}
        summary={
          shipment
            ? [d.reference, d.billOfEntryNo ? copy.billOfEntry(d.billOfEntryNo) : null, d.port]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        lead={{ kind: 'icon', node: <Truck aria-hidden="true" /> }}
        badges={shipment ? <OrderChip kind="inboundShipment" value={shipment.status} /> : null}
        back={{ label: copy.back, href: LIST }}
        actions={
          <>
            {shipment && shipment.status !== 'delivered' && shipment.status !== 'cancelled' ? (
              <Button variant="outline" onClick={() => setDelivering(shipment.id)} disabled={busy}>
                <PackageCheck aria-hidden="true" />
                {copy.deliver.action}
              </Button>
            ) : null}
            {shipment ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(true)}
                disabled={busy}
              >
                <Trash2 aria-hidden="true" />
                {copy.delete}
              </Button>
            ) : null}
            <Button loading={busy} onClick={handleSave} disabled={busy}>
              <Save aria-hidden="true" />
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
              <NoticeBar>{copy.saveFirst}</NoticeBar>
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
          <>
            <ShipmentTrackingCard
              draft={d}
              trackedAt={shipment?.trackedAt ?? null}
              canTrack={Boolean(shipment?.trackingNumber) && !dirty}
              tracking={tracking}
              onChange={patch}
              onTrack={handleTrack}
            />
            <NotesCard
              id="shipment-note"
              heading={copy.notes.heading}
              placeholder={copy.notes.placeholder}
              value={d.note}
              disabled={false}
              onChange={(note) => patch({ note })}
            />
            {shipment ? <ShipmentGlanceCard orders={shipment.orders} costs={costs} /> : null}
          </>
        }
      />
      <MarkDeliveredDialog
        shipmentId={delivering}
        onClose={() => setDelivering(null)}
        onDone={() => router.refresh()}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.confirmDelete.title}
        // The API refuses while purchase orders are linked: say so up front, not after confirming.
        body={hasOrders ? copy.confirmDelete.blocked : copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        cancelLabel={copy.confirmDelete.cancel}
        confirmDisabled={hasOrders}
        onConfirm={handleDelete}
      />
    </ProoflyPageBody>
  )
}
