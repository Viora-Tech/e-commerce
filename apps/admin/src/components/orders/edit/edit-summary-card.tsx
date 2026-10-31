'use client'

import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { orderEditContent } from '@/data/order-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail } from '../order-detail-types'
import { type EditState, isDirty, localChanges, localTotals } from './edit-state'

type EditSummaryCardProps = {
  order: OrderDetail
  state: EditState
  onDiscard: () => void
  /** "Update order": opens the review step. */
  onReview: () => void
}

/** "Discount (UPI discount)": the row name with what the merchant typed beside it. */
const withLabel = (name: string, label: string) =>
  label.trim() ? `${name} (${label.trim()})` : name

/**
 * The live summary beside the editor (#1014): "No changes have been made" until something
 * changes, then each change, the new total and the amount to collect or refund. "Update order"
 * waits for a change.
 */
export default function EditSummaryCard({
  order,
  state,
  onDiscard,
  onReview,
}: EditSummaryCardProps) {
  // Hooks
  const copy = useCopy(orderEditContent)
  const fmt = useFormat()

  // Render logic
  const dirty = isDirty(order, state)
  const changes = localChanges(order, state, copy.changes, fmt.money)
  const totals = localTotals(order, state)
  const paid = order.balance.capturedPaise - order.balance.refundedPaise
  const settles = order.checkoutPaidAt !== null
  const diff = totals.totalPaise - paid

  return (
    <DataCard
      title={copy.summary}
      footer={
        <>
          {/* Nothing is saved until Update, so discarding is just leaving for the order. */}
          <Button variant="outline" onClick={onDiscard}>
            {copy.discard}
          </Button>
          <Button disabled={!dirty} onClick={onReview}>
            {copy.review}
          </Button>
        </>
      }
    >
      {dirty ? (
        <div className="mb-4 flex flex-col gap-1.5">
          <p className="text-body-strong text-foreground">{copy.changesTitle}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-muted-foreground">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-4 text-body text-muted-foreground">{copy.noChanges}</p>
      )}
      {/* Label left, amount right, like the order page's payment summary (#19). */}
      <KeyValueList
        variant="grid"
        rows={[
          { label: copy.subtotal, value: fmt.money(totals.subtotalPaise) },
          {
            // The rate's own name when it has one, as the order page and invoice show it.
            label: state.shippingLabel.trim() || copy.shipping,
            value: fmt.money(totals.shippingPaise),
          },
          {
            label: withLabel(copy.discount, state.discountLabel),
            value: `−${fmt.money(totals.discountPaise)}`,
            hidden: totals.discountPaise === 0,
          },
          {
            label: copy.total,
            strong: true,
            value: `${fmt.money(totals.totalPaise)} (${copy.totalWas(fmt.money(order.totalPaise))})`,
          },
          { label: copy.paid, value: fmt.money(paid), hidden: !settles },
          {
            label: diff > 0 ? copy.owed : copy.owedBack,
            value: fmt.money(Math.abs(diff)),
            hidden: !settles || diff === 0 || !dirty,
          },
        ]}
      />
      {settles ? null : <p className="mt-3 text-caption text-muted-foreground">{copy.unpaid}</p>}
    </DataCard>
  )
}
