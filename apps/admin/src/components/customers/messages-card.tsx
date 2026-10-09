'use client'

import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import type { CustomerMessage } from './customer-detail-types'

type MessagesCardProps = {
  messages: CustomerMessage[]
}

/** How many recent messages the card lists. */
const SHOWN = 5

/** Recent notifications the store sent to this email: what, how, and whether it went. */
export default function MessagesCard({ messages }: MessagesCardProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)

  // Render logic
  const copy = detail.timeline

  return (
    <DataCard title={copy.heading} className="rounded-xl">
      {messages.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {messages.slice(0, SHOWN).map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-body text-foreground">
                  {copy.template[m.template] ?? m.template}
                </p>
                <p className="text-caption text-muted-foreground">
                  <RelativeTime value={m.createdAt} /> {copy.via(m.channel)}
                </p>
              </div>
              {m.status === 'sent' ? null : (
                <StatusChip tone={m.status === 'failed' ? 'danger' : 'attention'}>
                  {copy.status[m.status] ?? m.status}
                </StatusChip>
              )}
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
