import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { orderDetailContent } from '@/data/orders'
import { formatAgo, formatWhen } from '@/lib/format-date'
import type { OrderDetail } from './order-detail-types'

type TransferReminderLineProps = {
  order: OrderDetail
  onSend: () => void
  busy: boolean
}

const copy = orderDetailContent.payment.transfer

/** Matches the API's limit: one reminder per order every 6 hours. */
const REMINDER_EVERY_MS = 6 * 3_600_000

/**
 * An unpaid UPI / bank transfer order, above the attempts on the payment card:
 * "Waiting for the transfer · Reminder sent 3 hours ago" and the button that
 * sends the next one, greyed out until the 6-hour limit has passed.
 */
export default function TransferReminderLine({ order, onSend, busy }: TransferReminderLineProps) {
  // Render logic
  const sentAt = order.paymentReminderSentAt ? new Date(order.paymentReminderSentAt) : null
  const nextAt = sentAt ? new Date(sentAt.getTime() + REMINDER_EVERY_MS) : null
  const tooSoon = nextAt !== null && nextAt.getTime() > Date.now()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-body">
        <span className="font-medium">{copy.waiting}</span>
        <span className="text-muted-foreground">
          {' '}
          · {sentAt ? copy.reminderSent(formatAgo(sentAt)) : copy.noReminder}
          {tooSoon && nextAt ? ` · ${copy.nextAt(formatWhen(nextAt))}` : null}
        </span>
      </p>
      <Button size="sm" variant="outline" onClick={onSend} disabled={busy || tooSoon}>
        <Send aria-hidden="true" />
        {copy.send}
      </Button>
    </div>
  )
}
