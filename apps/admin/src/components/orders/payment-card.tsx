import { Button } from '@commerce/ui/shadcn/button'
import { DataCard } from '@/components/layout/data-card'
import { StatusPill, type StatusTone } from '@/components/layout/status-pill'
import { orderDetailContent as copy } from '@/data/orders'
import { formatPaise } from '@/lib/money'
import {
  methodLabel,
  type OrderDetail,
  type OrderPayment,
  paymentPill,
  refundedTotal,
  when,
} from './order-detail-types'

type PaymentCardProps = {
  order: OrderDetail
  /** Present when at least one payment can still be refunded. */
  onRefund?: (payment: OrderPayment) => void
}

const REFUND_TONE: Record<string, StatusTone> = {
  pending: 'warning',
  processed: 'success',
  failed: 'destructive',
  manual: 'info',
}

const EVENT_TONE: Record<string, StatusTone> = {
  processed: 'success',
  failed: 'destructive',
  pending: 'warning',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-body">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  )
}

/** Gateway, references, what was captured and what went back. */
export function PaymentCard({ order, onRefund }: PaymentCardProps) {
  const events = order.paymentEvents

  return (
    <DataCard title={copy.payment.heading}>
      <div className="flex flex-col gap-5">
        {order.payments.map((p) => {
          const pill = paymentPill(p, order.refunds)
          const back = refundedTotal(order.refunds, p.id)
          const refundable = p.status === 'captured' && back < p.amountPaise
          return (
            <div key={p.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{methodLabel(p.provider)}</p>
                <div className="flex items-center gap-3">
                  <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                  {refundable && onRefund ? (
                    <Button size="sm" variant="outline" onClick={() => onRefund(p)}>
                      {copy.actions.refund}
                    </Button>
                  ) : null}
                </div>
              </div>
              <dl className="flex flex-col gap-1.5">
                <Row label={copy.payment.reference} value={p.providerRef} />
                {p.providerPaymentId ? (
                  <Row label={copy.payment.gatewayId} value={p.providerPaymentId} />
                ) : null}
                <Row label={copy.payment.captured} value={formatPaise(p.amountPaise)} />
                {back > 0 ? (
                  <Row label={copy.payment.refundedTotal} value={`−${formatPaise(back)}`} />
                ) : null}
              </dl>
            </div>
          )
        })}

        {order.refunds.length > 0 ? (
          <section className="border-t border-border pt-4">
            <p className="text-caption mb-2">{copy.payment.refunds}</p>
            <ul className="flex flex-col gap-2">
              {order.refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-body">
                  <span className="min-w-0">
                    <span className="block font-medium tabular-nums">
                      {formatPaise(r.amountPaise)}
                    </span>
                    <span className="block truncate text-caption">
                      {[when(r.createdAt), r.reason].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <StatusPill tone={REFUND_TONE[r.status] ?? 'neutral'}>
                    {copy.payment.refundStatus[r.status] ?? r.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-t border-border pt-4">
          <p className="text-caption mb-2">{copy.payment.events}</p>
          {events.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.payment.noEvents}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-body">
                  <span className="min-w-0">
                    <code className="block text-[12px]">{e.type}</code>
                    <span className="block truncate text-caption">{when(e.receivedAt)}</span>
                    {e.error ? (
                      <span className="block truncate text-[12px] text-destructive">{e.error}</span>
                    ) : null}
                  </span>
                  <StatusPill tone={EVENT_TONE[e.status] ?? 'neutral'}>{e.status}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DataCard>
  )
}
