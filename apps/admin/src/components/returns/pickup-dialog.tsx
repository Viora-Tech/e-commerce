'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { returnDetailContent } from '@/data/returns'
import { api } from '@/lib/api-client'
import ChoiceList from './choice-list'
import type { PickupChoice, ReturnDetail } from './return-types'

type PickupDialogProps = {
  detail: ReturnDetail
  /** `approve`: approve and choose in one step. `arrange`: choose for an approved return. */
  mode: 'approve' | 'arrange' | null
  onClose: () => void
  onDone: () => void
}

const copy = returnDetailContent.approveDialog

function toChoice(value: string): PickupChoice {
  if (value === 'customer') return { method: 'customer' }
  if (value === 'later') return { method: 'later' }
  return { method: 'courier', providerId: value.replace(/^courier:/, '') }
}

/** A courier that can collect comes first; otherwise the customer sends it. */
function defaultChoice(detail: ReturnDetail): string {
  const first = detail.pickupCouriers[0]
  return first ? `courier:${first.id}` : 'customer'
}

/** Approve a return and say how it comes back: a courier pickup, or the customer sends it. */
export default function PickupDialog({ detail, mode, onClose, onDone }: PickupDialogProps) {
  // Hooks
  const [value, setValue] = useState(() => defaultChoice(detail))
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleConfirm = async () => {
    setBusy(true)
    try {
      const pickup = toChoice(value)
      if (mode === 'approve') {
        await api.returns.approve({ id: detail.id, pickup })
        toast.success(copy.done)
      } else {
        await api.returns.arrangePickup({ id: detail.id, pickup })
        toast.success(copy.arranged)
      }
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const choices = [
    ...detail.pickupCouriers.map((c) => ({
      value: `courier:${c.id}`,
      label: copy.courier(c.label),
      hint: copy.courierHint,
    })),
    { value: 'customer', label: copy.customer, hint: copy.customerHint },
    ...(mode === 'approve' ? [{ value: 'later', label: copy.later, hint: copy.laterHint }] : []),
  ]

  return (
    <FormDialog
      open={mode !== null}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      title={mode === 'approve' ? copy.title : copy.arrangeTitle}
      description={`${copy.body}${detail.pickupCouriers.length === 0 ? ` ${copy.noCourier}` : ''}`}
      submitLabel={mode === 'approve' ? copy.confirm : copy.arrangeConfirm}
      cancelLabel={returnDetailContent.cancel}
      busy={busy}
      onSubmit={handleConfirm}
    >
      <ChoiceList name="pickup" choices={choices} value={value} onChange={setValue} />
    </FormDialog>
  )
}
