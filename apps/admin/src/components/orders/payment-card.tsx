import { CircleCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import { formatWhen } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import {
  methodLabel,
  type OrderDetail,
  type OrderPayment,
  paymentStatus,
  refundedTotal,
} from './order-detail-types'

type PaymentCardProps = {
  order: OrderDetail
  /** Present when at least one payment can still be refunded. */
  onRefund?: (payment: OrderPayment) => void
  /** Present when money is still owed and can be recorded by hand. */
  onCollect?: (() => void) | undefined
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-body">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  )
}

/** What the amount row means for an attempt in this status. */
function amountLabel(status: OrderPayment['status']): string {
  if (status === 'captured' || status === 'refunded') return copy.payment.captured
  if (status === 'pending' || status === 'authorized') return copy.payment.authorised
  return copy.payment.amount
}

/** Gateway, references, what was captured and what went back. */
export default function PaymentCard({ order, onRefund, onCollect }: PaymentCardProps) {
  // Render logic
  const events = order.paymentEvents
  const multipleAttempts = order.payments.filter((p) => p.provider !== 'gift_card').length > 1

  return (
    <DataCard
      title={copy.payment.heading}
      action={
        onCollect ? (
          <Button variant="outline" onClick={onCollect}>
            <CircleCheck aria-hidden="true" />
            {copy.actions.collect}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {order.payments.map((p) => {
          const pill = paymentStatus(p, order.refunds)
          const back = refundedTotal(order.refunds, p.id)
          const refundable = p.status === 'captured' && back < p.amountPaise
          return (
            <div key={p.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  {methodLabel(p.provider)}
                  {multipleAttempts ? (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      {copy.payment.attempt(p.attempt)}
                    </span>
                  ) : null}
                </p>
                <div className="flex items-center gap-3">
                  <StatusLabel kind="payment" value={pill} variant="pill" />
                  {refundable && onRefund ? (
                    <Button size="sm" variant="outline" onClick={() => onRefund(p)}>
                      {copy.actions.refund}
                    </Button>
                  ) : null}
                </div>
              </div>
              {pill === 'refund_needed' ? (
                <p className="text-body text-destructive">{copy.payment.refundNeeded}</p>
              ) : null}
              <dl className="flex flex-col gap-1.5">
                <Row label={copy.payment.reference} value={p.providerRef} />
                {p.providerPaymentId ? (
                  <Row label={copy.payment.gatewayId} value={p.providerPaymentId} />
                ) : null}
                <Row label={amountLabel(p.status)} value={formatPaise(p.amountPaise)} />
                {back > 0 ? (
                  <Row label={copy.payment.refundedTotal} value={`−${formatPaise(back)}`} />
                ) : null}
              </dl>
            </div>
          )
        })}

        {order.refunds.length > 0 ? (
          <section className="border-t border-border pt-4">
            <p className="text-caption text-muted-foreground mb-2">{copy.payment.refunds}</p>
            <ul className="flex flex-col gap-2">
              {order.refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-body">
                  <span className="min-w-0">
                    <span className="block font-medium tabular-nums">
                      {formatPaise(r.amountPaise)}
                    </span>
                    <span className="block truncate text-caption font-normal">
                      {[formatWhen(r.createdAt), r.reason].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <StatusLabel kind="refund" value={r.status} variant="pill" size="sm" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-t border-border pt-4">
          <p className="text-caption text-muted-foreground mb-2">{copy.payment.events}</p>
          {events.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.payment.noEvents}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-body">
                  <span className="min-w-0">
                    <code className="block text-xs">{e.type}</code>
                    <span className="block truncate text-caption font-normal">
                      {formatWhen(e.receivedAt)}
                    </span>
                    {e.error ? (
                      <span className="block truncate text-xs text-destructive">{e.error}</span>
                    ) : null}
                  </span>
                  <StatusLabel kind="event" value={e.status} variant="pill" size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DataCard>
  )
}
