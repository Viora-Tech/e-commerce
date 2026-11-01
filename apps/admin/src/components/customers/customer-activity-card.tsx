'use client'

import { CancelCircle, MessageSquare, RotateCcw, ShoppingBag, Undo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import Timeline from '@/components/layout/timeline'
import { CHANNEL_LABEL } from '@/data/customer-privacy'
import { customerDetailContent } from '@/data/customers'
import { notificationsSettingsContent } from '@/data/notifications'
import { orderCancelContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { type ActivityEvent, activityFor, type CustomerDetail } from './customer-detail-types'

type CustomerActivityCardProps = {
  customer: CustomerDetail
}

/** Events shown before "Show older"; the card never grows past a screen on its own. */
const SHOWN = 6

function iconFor(e: ActivityEvent) {
  if (e.kind === 'order') return ShoppingBag
  if (e.kind !== 'orderEvent') return MessageSquare
  return e.event === 'refund' ? Undo : e.event === 'return' ? RotateCcw : CancelCircle
}

/**
 * The Timeline card: orders they placed, messages the store sent, staff notes (an opened
 * WhatsApp chat) and cancellations, returns and refunds on their orders, newest first. Cart and
 * campaign events join it when the store records them.
 */
export default function CustomerActivityCard({ customer }: CustomerActivityCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const names = useCopy(notificationsSettingsContent)
  const cancel = useCopy(orderCancelContent)
  const [all, setAll] = useState(false)

  // Helpers
  const describe = (e: ActivityEvent): string => {
    if (e.kind === 'order') return copy.activity.placed(e.number, formatPaise(e.totalPaise))
    if (e.kind === 'note') return e.body
    if (e.kind === 'orderEvent') return describeOrderEvent(e)
    // Plain names, never codes ("refund_issued", audit #42): the Notifications page's own names.
    const what =
      copy.timeline.template[e.template] ?? names.messages[e.template]?.name ?? e.template
    const channel =
      CHANNEL_LABEL[e.channel as keyof typeof CHANNEL_LABEL] ??
      names.channels[e.channel] ??
      e.channel
    return e.failed ? copy.activity.failed(what) : copy.activity.sent(what, channel)
  }

  const describeOrderEvent = (e: Extract<ActivityEvent, { kind: 'orderEvent' }>): string => {
    const a = copy.activity
    if (e.event === 'refund') return a.refunded(formatPaise(e.amountPaise ?? 0), e.orderNumber)
    if (e.event === 'return') {
      return (e.rto ? a.rto : a.returned)(e.orderNumber, e.returnNumber ?? 0)
    }
    const reason = e.reason
      ? (cancel.reasons[e.reason as keyof typeof cancel.reasons] ?? null)
      : null
    return a.cancelled(e.orderNumber, reason)
  }

  // Render logic
  const events = activityFor(customer)
  const visible = all ? events : events.slice(0, SHOWN)
  const hidden = events.length - visible.length

  // No activity yet: no empty card (audit #84).
  if (events.length === 0) return null

  return (
    <DataCard title={copy.activity.heading} className="rounded-xl">
      {events.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.activity.empty}</p>
      ) : (
        <>
          <Timeline
            items={visible.map((e) => ({
              id: e.id,
              title: describe(e),
              at: e.at,
              icon: iconFor(e),
            }))}
          />
          {events.length > SHOWN ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 -ml-2"
              onClick={() => setAll((open) => !open)}
            >
              {all ? copy.activity.less : copy.activity.more(hidden)}
            </Button>
          ) : null}
        </>
      )}
    </DataCard>
  )
}
