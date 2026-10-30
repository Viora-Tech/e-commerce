import { CircleCheck, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import FailedAttemptReason from './failed-attempt-reason'
import OrderChip from './order-chip'
import {
  methodLabel,
  type OrderDetail,
  type OrderPayment,
  paymentStatus,
  refundedTotal,
} from './order-detail-types'
import PreorderBalanceLine from './preorder-balance-line'
import TransferReminderLine from './transfer-reminder-line'

type PaymentCardProps = {
  order: OrderDetail
  /** Present when at least one payment can still be refunded. */
  onRefund?: (payment: OrderPayment) => void
  /** Present when money is still owed and can be recorded by hand. */
  onCollect?: (() => void) | undefined
  /** Present while a deposit pre-order's balance is owed: asks the customer for it. */
  onRequestBalance?: (() => void) | undefined
  /** Present on a placed UPI / bank transfer order: reminds the customer to pay. */
  onSendReminder?: (() => void) | undefined
  busy?: boolean
}

/** What the amount row means for an attempt in this status. */
function amountLabel(copy: typeof orderDetailContent, status: OrderPayment['status']): string {
  if (status === 'captured' || status === 'refunded') return copy.payment.captured
  if (status === 'pending' || status === 'authorized') return copy.payment.authorised
  return copy.payment.amount
}

/** Gateway, references, what was captured and what went back. */
export default function PaymentCard({
  order,
  onRefund,
  onCollect,
  onRequestBalance,
  onSendReminder,
  busy = false,
}: PaymentCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Helpers
  /** How a refund recorded by hand went back ("UPI", "Store credit"), when it says. */
  const refundMethod = (m: string | null) => {
    const methods = copy.refundDialog.methods
    return m && Object.hasOwn(methods, m) ? methods[m as keyof typeof methods] : null
  }

  // Render logic
  const events = order.paymentEvents
  const multipleAttempts = order.payments.filter((p) => p.provider !== 'gift_card').length > 1

  return (
    <DataCard
      title={copy.payment.transactions}
      action={
        onCollect ? (
          <Button variant="outline" size="sm" onClick={onCollect}>
            <CircleCheck aria-hidden="true" />
            {copy.actions.collect}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {order.depositPaise !== null ? (
          <PreorderBalanceLine order={order} onRequest={onRequestBalance} busy={busy} />
        ) : null}
        {onSendReminder ? (
          <TransferReminderLine
            order={order}
            onSend={onSendReminder}
            onMarkPaid={onCollect}
            busy={busy}
          />
        ) : null}
        {order.payments.map((p) => {
          const pill = paymentStatus(p, order.refunds)
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
                  <OrderChip kind="payment" value={pill} />
                  {refundable && onRefund ? (
                    <Button size="sm" variant="outline" onClick={() => onRefund(p)}>
                      <RotateCcw aria-hidden="true" />
                      {copy.actions.refund}
                    </Button>
                  ) : null}
                </div>
              </div>
              {pill === 'refund_needed' ? (
                <p className="text-body text-destructive">{copy.payment.refundNeeded}</p>
              ) : null}
              {p.status === 'failed' && p.error ? (
                <FailedAttemptReason provider={p.provider} error={p.error} />
              ) : null}
              <KeyValueList
                variant="grid"
                rows={[
                  { label: copy.payment.reference, value: p.providerRef, copy: true, strong: true },
                  {
                    label: copy.payment.gatewayId,
                    value: p.providerPaymentId,
                    copy: true,
                    strong: true,
                    hidden: !p.providerPaymentId,
                  },
                  {
                    label: amountLabel(copy, p.status),
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
    </DataCard>
  )
}
