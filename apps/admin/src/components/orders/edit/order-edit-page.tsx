'use client'

import type { OrderEditInput } from '@commerce/core'
import { canEditOrder, editsAfterShipping } from '@commerce/core/order-edit-rules'
import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import { orderEditContent } from '@/data/order-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { OrderDetail } from '../order-detail-types'
import EditLinesCard from './edit-lines-card'
import EditReviewDialog from './edit-review-dialog'
import EditShippedAlert from './edit-shipped-alert'
import { type EditState, editInput, isDirty, localTotals, startState } from './edit-state'

type OrderEditPageProps = {
  order: OrderDetail
}

/** As long as the server keeps (`OrderEditSchema`). */
const LABEL_MAX = 120

/** "Discount (UPI discount)": the row name with what the merchant typed beside it. */
const withLabel = (name: string, label: string) =>
  label.trim() ? `${name} (${label.trim()})` : name

/**
 * `/orders/<id>/edit`: Shopify-style order editing on a full page. Items, quantities, prices,
 * shipping and discount (each with a label) on the left, the running summary on the right; "Review changes" opens the review
 * dialog, which works the difference out on the server and saves. A shipped order can be edited
 * too, under a warning that the shipment stays as it is.
 */
export default function OrderEditPage({ order }: OrderEditPageProps) {
  // Hooks
  const copy = useCopy(orderEditContent)
  const fmt = useFormat()
  const router = useRouter()
  const [state, setState] = useState<EditState>(() => startState(order))
  const [reviewing, setReviewing] = useState<OrderEditInput | null>(null)

  // Helpers
  const patch = (next: Partial<EditState>) => setState((s) => ({ ...s, ...next }))

  // Event handlers
  const handleSaved = () => {
    setReviewing(null)
    router.push(routes.orders.detail(order.id))
    router.refresh()
  }

  // Render logic
  const backHref = routes.orders.detail(order.id)
  const editable = canEditOrder(order)
  // Packed or on its way (a booked shipment counts even while other items wait to be packed).
  const shipped =
    editsAfterShipping(order) || (order.shipment !== null && order.shipment.status !== 'cancelled')
  const dirty = isDirty(order, state)
  const totals = localTotals(order, state)
  const paid = order.balance.capturedPaise - order.balance.refundedPaise
  const settles = order.checkoutPaidAt !== null
  const diff = totals.totalPaise - paid

  return (
    // The order page's centred 75rem frame, so editing does not jump wider and left (#19).
    <PageBody className="mx-auto max-w-[75rem] gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.pageTitle(order.number)}
        subtitle={copy.intro}
        back={{ label: copy.back(order.number), href: backHref }}
        lead={{ kind: 'icon', node: <Pencil aria-hidden="true" /> }}
      />
      {editable && shipped ? <EditShippedAlert /> : null}
      {editable ? (
        <PageColumns
          main={
            <>
              <EditLinesCard order={order} state={state} onChange={patch} />
              <DataCard title={copy.charges} bodyClassName="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="edit-shipping">{copy.shipping}</FieldLabel>
                  <DraftMoneyInput
                    id="edit-shipping"
                    valuePaise={state.shippingPaise}
                    onChangePaise={(shippingPaise) => patch({ shippingPaise })}
                    className="tabular-nums"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-shipping-label">{copy.shippingLabel}</FieldLabel>
                  <Input
                    id="edit-shipping-label"
                    value={state.shippingLabel}
                    maxLength={LABEL_MAX}
                    placeholder={copy.shippingLabelPlaceholder}
                    onChange={(e) => patch({ shippingLabel: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-discount">{copy.discount}</FieldLabel>
                  <DraftMoneyInput
                    id="edit-discount"
                    valuePaise={state.discountPaise}
                    onChangePaise={(discountPaise) => patch({ discountPaise })}
                    className="tabular-nums"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-discount-label">{copy.discountLabel}</FieldLabel>
                  <Input
                    id="edit-discount-label"
                    value={state.discountLabel}
                    maxLength={LABEL_MAX}
                    placeholder={copy.discountLabelPlaceholder}
                    onChange={(e) => patch({ discountLabel: e.target.value })}
                  />
                </Field>
              </DataCard>
            </>
          }
          side={
            <DataCard
              title={copy.summary}
              footer={
                <>
                  {/* Nothing is saved until Review, so discarding is just leaving for the order. */}
                  <Button variant="outline" onClick={() => router.push(backHref)}>
                    {copy.discard}
                  </Button>
                  <Button disabled={!dirty} onClick={() => setReviewing(editInput(order, state))}>
                    {copy.review}
                  </Button>
                </>
              }
            >
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
                    hidden: !settles || diff === 0,
                  },
                ]}
              />
              {settles ? null : (
                <p className="mt-3 text-caption text-muted-foreground">{copy.unpaid}</p>
              )}
            </DataCard>
          }
        />
      ) : (
        <DataCard title={copy.items}>
          <p className="text-body text-muted-foreground">{copy.notEditable}</p>
        </DataCard>
      )}
      <EditReviewDialog
        input={reviewing}
        shipped={shipped}
        onClose={() => setReviewing(null)}
        onSaved={handleSaved}
      />
    </PageBody>
  )
}
