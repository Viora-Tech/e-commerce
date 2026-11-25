import { paymentOverdue } from '@commerce/core/payment-terms'
import { CircleCheck, CreditCard, Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import StatusLabel from '@/components/status/status-label'
import { toneFor } from '@/components/status/tone'
import { orderDetailContent } from '@/data/order-detail'
import { orderEditContent } from '@/data/order-edit'
import { type StatusValue, statusEntry } from '@/data/status'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { shownAttemptStatus } from '@/lib/order-next-move'
import type { OrderDetail, OrderPayment } from './order-detail-types'
import PaymentDetails from './payment-details'
import PaymentTotals from './payment-totals'
import PreorderBalanceLine from './preorder-balance-line'
import StatusCardTitle from './status-card-title'
import TransferReminderLine from './transfer-reminder-line'

type PaymentCardProps = {
  order: OrderDetail
  /** The order's payment pill, beside the title. */
  payment: StatusValue<'payment'>
  /** Where "Edit order" goes (change items, prices, shipping, discount); undefined hides it. */
  editHref?: string | undefined
  /** Present when at least one payment can still be refunded. */
  onRefund?: ((payment: OrderPayment) => void) | undefined
  /** Present when the member may capture an authorised (manual-capture) payment (#150). */
  onCapture?: ((payment: OrderPayment) => void) | undefined
  /** Present when money is still owed and can be recorded by hand. */
  onCollect?: (() => void) | undefined
  /** Present while a deposit pre-order's balance is owed: asks the customer for it. */
  onRequestBalance?: (() => void) | undefined
  /** Present on a placed UPI / bank transfer order: reminds the customer to pay. */
  onSendReminder?: (() => void) | undefined
  busy?: boolean
}

/**
 * One Payment card, after Shopify's (Figma "Orders / Order detail" › Payment): the status in
 * the title, the bill (subtotal, discount, shipping, fees | total | paid, balance), what is
 * still owed and when, then the gateway side folded under "Payment details".
 */
export default function PaymentCard({
  order,
  payment,
  editHref,
  onRefund,
  onCapture,
  onCollect,
  onRequestBalance,
  onSendReminder,
  busy = false,
}: PaymentCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const editCopy = useCopy(orderEditContent)
  const fmt = useFormat()

  // Render logic
  // A cancelled order: no "Payment pending" under Voided; money still held reads Refund due.
  const shownPill = shownAttemptStatus(order.status, payment)
  const tone = shownPill ? toneFor(statusEntry('payment', shownPill).tone) : 'neutral'
  // Payment due later (#1029): shown while money is still owed.
  const owed = order.paymentTerms !== null && order.paymentStatus !== 'paid'
  const dueAt = order.paymentDueAt ? new Date(order.paymentDueAt) : null
  const overdue = owed && paymentOverdue(dueAt, new Date())

  return (
    <DataCard
      title={
        <StatusCardTitle icon={<CreditCard />} tone={tone}>
          {copy.payment.heading}
          {shownPill ? <StatusLabel kind="payment" value={shownPill} variant="soft" /> : null}
        </StatusCardTitle>
      }
      action={
        onCollect || editHref ? (
          <>
            {onCollect ? (
              <Button variant="outline" size="sm" onClick={onCollect}>
                <CircleCheck aria-hidden="true" />
                {copy.actions.collect}
              </Button>
            ) : null}
            {editHref ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={editHref} />}
              >
                <Pencil aria-hidden="true" />
                {editCopy.action}
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <PaymentTotals order={order} />
        {owed ? (
          <p className="flex items-center gap-2 text-body">
            {dueAt ? copy.payment.dueOn(fmt.date(dueAt)) : copy.payment.dueOnFulfilment}
            {overdue ? (
              <StatusChip tone="attention" variant="outline">
                {copy.payment.overdue}
              </StatusChip>
            ) : null}
          </p>
        ) : null}
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
        <PaymentDetails order={order} onRefund={onRefund} onCapture={onCapture} busy={busy} />
      </div>
    </DataCard>
  )
}
