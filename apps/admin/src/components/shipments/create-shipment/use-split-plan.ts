'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import type { DraftParcel, PackageForm } from './flow-state'
import { isPartial, keepOf, plannedParcel, type SplitPlan, startingPlan } from './partial-plan'

/**
 * Partial shipment on Create shipment (Figma 916:10179): which items ship now, why the rest
 * waits and whether the customer is told. Nothing is split until the booking starts: `split`
 * runs first, the parcel keeps the ticked items and the rest becomes Part 2 in To ship.
 */
export function useSplitPlan(orderId: string) {
  // Hooks
  const [plan, setPlan] = useState<SplitPlan | null>(null)

  /** A parcel opened: what is on the shelf starts ticked. Returns the parcel as it ships now. */
  const start = (parcel: DraftParcel): DraftParcel => {
    const next = startingPlan(parcel.lines)
    setPlan(next)
    return plannedParcel(parcel, next.counts)
  }

  /** Ticks changed: the package's weight and, for COD, the amount to collect follow. */
  const change = (
    next: SplitPlan,
    parcel: DraftParcel | undefined,
    form: PackageForm | null,
  ): PackageForm | null => {
    setPlan(next)
    if (!parcel || !form) return form
    const now = plannedParcel(parcel, next.counts)
    return {
      ...form,
      weightGrams: String(now.weightGrams),
      codAmount: form.paymentMode === 'cod' ? String(now.valuePaise / 100) : form.codAmount,
    }
  }

  /** The parcel as it ships now (the whole parcel when nothing is unticked). */
  const shown = (parcel: DraftParcel): DraftParcel =>
    plan ? plannedParcel(parcel, plan.counts) : parcel

  /** Before booking: split off what stays when only some items go. True when it split. */
  const split = async (parcel: DraftParcel): Promise<boolean> => {
    if (!parcel.id || !plan || !isPartial(parcel.lines, plan.counts)) return false
    await api.shipments.splitParcel({
      orderId,
      fulfillmentOrderId: parcel.id,
      keep: keepOf(parcel.lines, plan.counts),
      reason: plan.reason,
      notifyCustomer: plan.notify,
    })
    return true
  }

  return { plan, start, change, shown, split }
}
