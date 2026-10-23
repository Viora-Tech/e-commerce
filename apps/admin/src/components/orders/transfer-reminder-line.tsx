import { CircleCheck, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail } from './order-detail-types'

type TransferReminderLineProps = {
  order: OrderDetail
  onSend: () => void
  /** Present while money is still owed and can be recorded by hand: the prominent action. */
  onMarkPaid?: (() => void) | undefined
  busy: boolean
}

/** Matches the API's limit: one reminder per order every 6 hours. */
const REMINDER_EVERY_MS = 6 * 3_600_000

/**
 * An unpaid UPI / bank transfer order, above the attempts on the payment card:
 * "Waiting for the transfer · Reminder sent 3 hours ago", a hint telling the merchant
 * exactly what to go check, and the prominent action to confirm it themselves once they have.
 */
export default function TransferReminderLine({
  order,
  onSend,
  onMarkPaid,
  busy,
}: TransferReminderLineProps) {
  // Hooks
  const detail = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = detail.payment.transfer
  const sentAt = order.paymentReminderSentAt ? new Date(order.paymentReminderSentAt) : null
  const nextAt = sentAt ? new Date(sentAt.getTime() + REMINDER_EVERY_MS) : null
  const tooSoon = nextAt !== null && nextAt.getTime() > Date.now()

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body">
          <span className="font-medium">{copy.waiting}</span>
          <span className="text-muted-foreground">
            {' '}
            · {sentAt ? copy.reminderSent(fmt.ago(sentAt)) : copy.noReminder}
            {tooSoon && nextAt ? ` · ${copy.nextAt(fmt.when(nextAt))}` : null}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={onSend} disabled={busy || tooSoon}>
          <Send aria-hidden="true" />
          {copy.send}
        </Button>
      </div>
      {onMarkPaid ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-3">
          <p className="text-body text-muted-foreground">
            {copy.hint(fmt.money(order.balance.balancePaise))}
          </p>
          <Button size="sm" onClick={onMarkPaid} disabled={busy}>
            <CircleCheck aria-hidden="true" />
            {copy.markPaid}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
