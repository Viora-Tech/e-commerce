'use client'

import type { OrderEditInput } from '@commerce/core'
import { canEditOrder } from '@commerce/core/order-edit-rules'
import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
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
import { type EditState, editInput, isDirty, localTotals, startState } from './edit-state'

type OrderEditPageProps = {
  order: OrderDetail
}

/**
 * `/orders/<id>/edit`: Shopify-style order editing on a full page. Items, quantities, shipping
 * and discount on the left, the running summary on the right; "Review changes" opens the review
 * dialog, which works the difference out on the server and saves.
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
  const dirty = isDirty(order, state)
  const totals = localTotals(order, state)
  const paid = order.balance.capturedPaise - order.balance.refundedPaise
  const settles = order.checkoutPaidAt !== null
  const diff = totals.totalPaise - paid

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.pageTitle(order.number)}
        subtitle={copy.intro}
        back={{ label: copy.back(order.number), href: backHref }}
        lead={{ kind: 'icon', node: <Pencil aria-hidden="true" /> }}
      />
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
                  <FieldLabel htmlFor="edit-discount">{copy.discount}</FieldLabel>
                  <DraftMoneyInput
                    id="edit-discount"
                    valuePaise={state.discountPaise}
                    onChangePaise={(discountPaise) => patch({ discountPaise })}
                    className="tabular-nums"
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
                  <Button
                    variant="outline"
                    disabled={!dirty}
                    onClick={() => setState(startState(order))}
                  >
                    {copy.discard}
                  </Button>
                  <Button disabled={!dirty} onClick={() => setReviewing(editInput(order, state))}>
                    {copy.review}
                  </Button>
                </>
              }
            >
              <KeyValueList
                rows={[
                  { label: copy.subtotal, value: fmt.money(totals.subtotalPaise) },
                  { label: copy.shipping, value: fmt.money(totals.shippingPaise) },
                  {
                    label: copy.discount,
                    value: `−${fmt.money(totals.discountPaise)}`,
                    hidden: totals.discountPaise === 0,
                  },
                  {
                    label: copy.total,
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
        onClose={() => setReviewing(null)}
        onSaved={handleSaved}
      />
    </PageBody>
  )
}
