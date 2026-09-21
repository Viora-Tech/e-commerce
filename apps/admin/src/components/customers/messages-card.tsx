import { Bell } from 'lucide-react'
import { DataCard } from '@/components/layout/data-card'
import { StatusPill, type StatusTone } from '@/components/layout/status-pill'
import { customerDetailContent as copy } from '@/data/customers'
import { type CustomerMessage, when } from './customer-detail-types'

type MessagesCardProps = {
  messages: CustomerMessage[]
}

const TONE: Record<string, StatusTone> = {
  sent: 'success',
  queued: 'warning',
  failed: 'destructive',
}

/** Every notification the store sent to this email, newest first. */
export function MessagesCard({ messages }: MessagesCardProps) {
  const c = copy.timeline
  return (
    <DataCard title={c.heading}>
      {messages.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-border pl-6">
          {messages.map((m) => (
            <li key={m.id} className="relative">
              <span
                className="absolute top-0 -left-8 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
                aria-hidden="true"
              >
                <Bell className="size-3.5" />
              </span>
              <div className="flex items-center justify-between gap-3">
                <p className="text-body font-medium">{c.template[m.template] ?? m.template}</p>
                <StatusPill tone={TONE[m.status] ?? 'neutral'}>
                  {c.status[m.status] ?? m.status}
                </StatusPill>
              </div>
              <p className="text-caption">
                {when(m.createdAt)} {c.via(m.channel)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </DataCard>
  )
}
