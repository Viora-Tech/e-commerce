'use client'

import { ChevronDown, CreditCard, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import KeyValueList from '@/components/layout/key-value-list'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent } from '@/data/order-detail'
import { paymentRulesContent } from '@/data/payment-rules'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { shownAttemptStatus } from '@/lib/order-next-move'
import FailedAttemptReason from './failed-attempt-reason'
import {
  methodLabel,
  type OrderDetail,
  type OrderPayment,
  paymentStatus,
  refundedTotal,
} from './order-detail-types'

type PaymentDetailsProps = {
  order: OrderDetail
  /** Present when at least one payment can still be refunded. */
  onRefund?: ((payment: OrderPayment) => void) | undefined
  /** Present when the member may capture an authorised (manual-capture) payment (#150). */
  onCapture?: ((payment: OrderPayment) => void) | undefined
  busy: boolean
}

/** What the amount row means for an attempt in this status. */
function amountLabel(copy: typeof orderDetailContent, status: OrderPayment['status']): string {
  if (status === 'captured' || status === 'refunded') return copy.payment.captured
  if (status === 'pending' || status === 'authorized') return copy.payment.authorised
  return copy.payment.amount
}

/**
 * The Payment card's folded "Payment details" (was the Transactions card): each attempt with
 * its references, Capture and Refund, the refunds, and the raw gateway events. It starts open
 * when an attempt needs the merchant (a capture, a refund owed, a failure).
 */
export default function PaymentDetails({ order, onRefund, onCapture, busy }: PaymentDetailsProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const { order: captureCopy } = useCopy(paymentRulesContent)
  const fmt = useFormat()

  // Helpers
  /** How a refund recorded by hand went back ("UPI", "Store credit"), when it says. */
  const refundMethod = (m: string | null) => {
    const methods = copy.refundDialog.methods
    return m && Object.hasOwn(methods, m) ? methods[m as keyof typeof methods] : null
  }

  // Early returns
  const events = order.paymentEvents
  if (order.payments.length === 0 && order.refunds.length === 0 && events.length === 0) return null

  // Render logic
  // Gift cards and store credit sit beside the attempts; they are not attempts themselves.
  const multipleAttempts =
    order.payments.filter((p) => p.provider !== 'gift_card' && p.provider !== 'store_credit')
      .length > 1
  const needsLook = order.payments.some(
    (p) =>
      (p.status === 'authorized' && onCapture) ||
      p.status === 'failed' ||
      paymentStatus(p, order.refunds) === 'refund_needed',
  )

  return (
    <Collapsible defaultOpen={needsLook} className="border-hairline border-t pt-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {copy.payment.details}
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-5 pt-4">
          {order.payments.map((p) => {
            const pill = paymentStatus(p, order.refunds)
            // A cancelled order: no "Payment pending" under Voided; money held reads Refund due.
            const shown = shownAttemptStatus(order.status, pill)
            const back = refundedTotal(order.refunds, p.id)
            const refundable = p.status === 'captured' && back < p.amountPaise
            return (
              <div key={p.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {methodLabel(p.provider, copy)}
                    {multipleAttempts ? (
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        {copy.payment.attempt(p.attempt)}
                        {p.purpose === 'balance' ? ` · ${copy.payment.balanceAttempt}` : null}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-3">
                    {shown ? <StatusLabel kind="payment" value={shown} variant="soft" /> : null}
                    {p.status === 'authorized' && onCapture ? (
                      <Button
                        loading={busy}
                        size="sm"
                        variant="outline"
                        onClick={() => onCapture(p)}
                        disabled={busy}
                      >
                        <CreditCard aria-hidden="true" />
                        {captureCopy.capture}
                      </Button>
                    ) : null}
                    {refundable && onRefund ? (
                      <Button size="sm" variant="outline" onClick={() => onRefund(p)}>
                        <RotateCcw aria-hidden="true" />
                        {copy.actions.refund}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {p.status === 'authorized' ? (
                  <p className="text-body text-muted-foreground">{captureCopy.held}</p>
                ) : null}
                {pill === 'refund_needed' ? (
                  <p className="text-body text-destructive">{copy.payment.refundNeeded}</p>
                ) : null}
                {p.status === 'failed' && p.error ? (
                  <FailedAttemptReason provider={p.provider} error={p.error} />
                ) : null}
                <KeyValueList
                  variant="grid"
                  rows={[
                    {
                      label: copy.payment.reference,
                      value: p.providerRef,
                      copy: true,
                      strong: true,
                    },
                    {
                      label: copy.payment.gatewayId,
                      value: p.providerPaymentId,
                      copy: true,
                      strong: true,
                      hidden: !p.providerPaymentId,
                    },
                    {
                      label: amountLabel(copy, shown === null ? 'cancelled' : p.status),
                      value: fmt.money(p.amountPaise),
                      strong: true,
                    },
                    {
                      label: copy.payment.refundedTotal,
                      value: `−${fmt.money(back)}`,
                      strong: true,
                      hidden: back <= 0,
                    },
                  ]}
                />
              </div>
            )
          })}

          {order.refunds.length > 0 ? (
            <section className="border-t border-line pt-4">
              <p className="text-eyebrow mb-2">{copy.payment.refunds}</p>
              <ul className="flex flex-col gap-2">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-body">
                    <span className="min-w-0">
                      <span className="block font-medium tabular-nums">
                        {fmt.money(r.amountPaise)}
                      </span>
                      <span className="block truncate text-caption font-normal">
                        {[fmt.when(r.createdAt), refundMethod(r.method), r.reason]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </span>
                    <StatusLabel kind="refund" value={r.status} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* None yet (manual and COD payments never have any): no empty section (audit #12). */}
          {events.length === 0 ? null : (
            <section className="border-t border-line pt-4">
              <p className="text-eyebrow mb-2">{copy.payment.events}</p>
              <ul className="flex flex-col gap-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 text-body">
                    <span className="min-w-0">
                      <code className="block text-xs">{e.type}</code>
                      <RelativeTime
                        value={e.receivedAt}
                        className="block truncate text-caption font-normal"
                      />
                      {e.error ? (
                        <span className="block truncate text-xs text-destructive">{e.error}</span>
                      ) : null}
                    </span>
                    <StatusLabel kind="event" value={e.status} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
