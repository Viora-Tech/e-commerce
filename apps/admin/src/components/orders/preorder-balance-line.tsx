import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail } from './order-detail-types'

type PreorderBalanceLineProps = {
  order: OrderDetail
  /** Present while a balance is owed and can be asked for (again). */
  onRequest?: (() => void) | undefined
  busy: boolean
}

/** What the deposit attempts took and kept: the "Deposit paid" figure. */
function depositPaid(order: OrderDetail): number {
  return order.payments
    .filter((p) => p.purpose === 'order' && p.status === 'captured' && !p.refundNeeded)
    .reduce((sum, p) => sum + p.amountPaise, 0)
}

/**
 * A deposit pre-order's balance at a glance, above the attempts on the payment
 * card: "Deposit paid ₹X · Balance due ₹Y (requested <date>, N reminders sent)".
 */
export default function PreorderBalanceLine({ order, onRequest, busy }: PreorderBalanceLineProps) {
  // Hooks
  const detail = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = detail.payment.preorder
  const owed = order.balanceDuePaise ?? 0
  const state = order.balancePaidAt
    ? copy.balancePaid(fmt.when(order.balancePaidAt))
    : `${copy.balanceDue(fmt.money(owed))} (${
        order.balanceRequestedAt
          ? copy.requested(fmt.when(order.balanceRequestedAt), order.balanceRemindersSent)
          : copy.notRequested
      })`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-body">
        <span className="font-medium">{copy.depositPaid(fmt.money(depositPaid(order)))}</span>
        <span className="text-muted-foreground"> · {state}</span>
      </p>
      {onRequest ? (
        <Button size="sm" variant="outline" onClick={onRequest} disabled={busy}>
          <Send aria-hidden="true" />
          {order.balanceRequestedAt ? copy.resend : copy.request}
        </Button>
      ) : null}
    </div>
  )
}
