'use client'

import { MessageSquare, ShoppingBag } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import Timeline from '@/components/layout/timeline'
import { CHANNEL_LABEL } from '@/data/customer-privacy'
import { customerDetailContent } from '@/data/customers'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { type ActivityEvent, activityFor, type CustomerDetail } from './customer-detail-types'

type CustomerActivityCardProps = {
  customer: CustomerDetail
}

/** Events shown before "Show older"; the card never grows past a screen on its own. */
const SHOWN = 6

/**
 * The Timeline card: orders they placed, messages the store sent and staff notes (an opened
 * WhatsApp chat), newest first. Cart and
 * campaign events join it when the store records them.
 */
export default function CustomerActivityCard({ customer }: CustomerActivityCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const names = useCopy(notificationsSettingsContent)
  const [all, setAll] = useState(false)

  // Helpers
  const describe = (e: ActivityEvent): string => {
    if (e.kind === 'order') return copy.activity.placed(e.number, formatPaise(e.totalPaise))
    if (e.kind === 'note') return e.body
    // Plain names, never codes ("refund_issued", audit #42): the Notifications page's own names.
    const what =
      copy.timeline.template[e.template] ?? names.messages[e.template]?.name ?? e.template
    const channel =
      CHANNEL_LABEL[e.channel as keyof typeof CHANNEL_LABEL] ??
      names.channels[e.channel] ??
      e.channel
    return e.failed ? copy.activity.failed(what) : copy.activity.sent(what, channel)
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
              icon: e.kind === 'order' ? ShoppingBag : MessageSquare,
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
