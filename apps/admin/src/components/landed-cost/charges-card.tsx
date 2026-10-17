'use client'

import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { toast } from 'sonner'
import KitIconButton from '@/components/kit/kit-icon-button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { chargesContent, warningText } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatMinor } from '@/lib/money'
import ChargeDialog from './charge-dialog'
import type { ChargeOwner, CostPreview, PreviewCharge } from './types'

type ChargesCardProps = {
  /** Null until the order or shipment is saved. */
  costs: CostPreview | null
  owner: ChargeOwner | null
  /** Charges can be added and changed (not on a cancelled order). */
  editable: boolean
  /** On a purchase order: the shipment it is on, whose shared charges show read-only. */
  shipmentNumber?: number | null
  onChanged: () => void
}

type Editing = { charge: PreviewCharge | null } | null

function ownedBy(charge: PreviewCharge, owner: ChargeOwner): boolean {
  return 'purchaseOrderId' in owner
    ? charge.purchaseOrderId === owner.purchaseOrderId
    : charge.inboundShipmentId === owner.inboundShipmentId && charge.purchaseOrderId === null
}

/** Freight, duty, clearing and bank charges with their split; a late bill revalues stock. */
export default function ChargesCard({
  costs,
  owner,
  editable,
  shipmentNumber,
  onChanged,
}: ChargesCardProps) {
  // Hooks
  const copy = useCopy(chargesContent)
  const fmt = useFormat()
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  // Event handlers
  const handleRemove = async () => {
    if (!removing) return
    try {
      await api.purchaseCharges.remove({ id: removing })
      toast.success(copy.removed)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setRemoving(null)
    }
  }

  // Render logic
  const forShipment = owner !== null && 'inboundShipmentId' in owner
  const all = costs?.charges ?? []
  const shown = owner
    ? all.filter((c) => ownedBy(c, owner) || (!forShipment && c.purchaseOrderId === null))
    : []
  const shownIds = new Set(shown.map((c) => c.id))
  const warnings = (costs?.warnings ?? []).filter((w) => shownIds.has(w.chargeId))
  const lines = (costs?.lines ?? []).filter(
    (l) => !owner || !('purchaseOrderId' in owner) || l.purchaseOrderId === owner.purchaseOrderId,
  )

  return (
    <Card size="form" gap="none" inset="y-none">
      <CardHeader className="grid-cols-[1fr_auto] items-center py-5">
        <span className="flex flex-col gap-1">
          <CardTitle>{forShipment ? copy.shipmentHeading : copy.heading}</CardTitle>
          <CardDescription>{copy.summary}</CardDescription>
        </span>
        {owner && editable ? (
          <Button variant="outline" onClick={() => setEditing({ charge: null })}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        ) : null}
      </CardHeader>
      {!owner ? (
        <EmptyState
          variant="plain"
          size="md"
          className="border-line border-t px-5"
          body={copy.saveFirst}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          variant="plain"
          size="md"
          className="border-line border-t px-5"
          body={copy.empty}
        />
      ) : (
        <ul className="flex flex-col border-line border-t">
          {shown.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 border-line border-b px-5 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body">{copy.kinds[c.kind]}</span>
                <span className="text-caption text-muted-foreground">
                  {[
                    copy.methods[c.appliedMethod],
                    c.payee,
                    c.note,
                    !ownedBy(c, owner) && shipmentNumber ? copy.fromShipment(shipmentNumber) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1 text-right">
                <span className="text-body tabular-nums">
                  {formatMinor(c.amountMinor, c.currency)}
                </span>
                {c.currency === 'INR' ? null : (
                  <span className="text-caption text-muted-foreground tabular-nums">
                    = {fmt.money(c.amountPaise)}
                  </span>
                )}
                {c.gstPaise > 0 ? (
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {copy.gst(fmt.money(c.gstPaise))}
                  </span>
                ) : null}
                <StatusChip tone={c.recoverable ? 'info' : 'neutral'}>
                  {c.recoverable ? copy.notInCost : copy.inCost}
                </StatusChip>
              </span>
              {editable && ownedBy(c, owner) ? (
                <span className="flex gap-1">
                  <KitIconButton
                    label={copy.edit}
                    className="size-9"
                    onClick={() => setEditing({ charge: c })}
                  >
                    <Pencil aria-hidden="true" />
                  </KitIconButton>
                  <KitIconButton
                    label={copy.remove}
                    className="size-9"
                    onClick={() => setRemoving(c.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </KitIconButton>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 border-line border-t bg-warning-soft px-5 py-3 text-caption text-warning">
          {warnings.map((w) => (
            <li key={`${w.code}-${w.chargeId}`}>
              {copy.kinds[all.find((c) => c.id === w.chargeId)?.kind ?? 'other']}:{' '}
              {warningText(copy, w)}
            </li>
          ))}
        </ul>
      ) : null}
      {owner && editing ? (
        <ChargeDialog
          owner={owner}
          charge={editing.charge}
          lines={lines}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={onChanged}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={copy.confirmRemove.title}
        body={copy.confirmRemove.body}
        confirmLabel={copy.confirmRemove.confirm}
        cancelLabel={copy.confirmRemove.cancel}
        onConfirm={handleRemove}
      />
    </Card>
  )
}
