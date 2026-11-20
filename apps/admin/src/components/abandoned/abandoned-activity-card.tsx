import { CircleCheck, Clock, Send, ShoppingCart } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import Timeline, { type TimelineItem } from '@/components/layout/timeline'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

const TIME = { hour: 'numeric', minute: '2-digit' } as const

type AbandonedActivityCardProps = {
  checkout: AbandonedCheckout
}

type Entry = Omit<TimelineItem, 'at'> & { at: Date | string }

/**
 * Figma "Abandoned checkout · Polish" › Activity: icon markers under day headings, each with a
 * line of detail (the channel and address a reminder went to, where the checkout started), and
 * "Not recovered yet" at the foot while the cart has no order.
 */
export default function AbandonedActivityCard({ checkout }: AbandonedActivityCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.activity
  const channels = content.reminder.channels
  const items = content.cart.items(checkout.itemCount)
  const total = fmt.money(checkout.subtotalPaise)
  const from = checkout.attribution?.source ?? checkout.attribution?.referrer ?? null
  const touched = new Date(checkout.updatedAt).getTime()
  const sent = checkout.reminders.filter((r) => r.status === 'sent')
  const entries: Entry[] = [
    ...(checkout.recovered
      ? [{ id: 'recovered', title: copy.recovered, at: checkout.updatedAt, icon: CircleCheck }]
      : []),
    ...(sent.length > 0
      ? sent.map((r) => ({
          id: `reminded-${r.channel}`,
          title: copy.reminded,
          detail: copy.remindedVia(channels[r.channel] ?? r.channel, r.to),
          at: r.at,
          icon: Send,
        }))
      : checkout.recoverySentAt
        ? [{ id: 'reminded', title: copy.reminded, at: checkout.recoverySentAt, icon: Send }]
        : []),
    ...(touched - new Date(checkout.createdAt).getTime() > 60_000 && !checkout.recovered
      ? [{ id: 'active', title: copy.lastActive, at: checkout.updatedAt, icon: Clock }]
      : []),
    {
      id: 'started',
      title: copy.started,
      detail: from ? copy.startedFrom(from, items, total) : copy.startedDetail(items, total),
      at: checkout.createdAt,
      icon: ShoppingCart,
    },
  ]
  const sorted = entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((e) => ({ ...e, day: fmt.day(e.at), time: fmt.pattern(e.at, TIME) }))
  const days = [...new Set(sorted.map((e) => e.day))]
  const groups = days.map((day) => ({
    key: day,
    label: day,
    items: sorted.filter((e) => e.day === day),
  }))

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-4">
      <Timeline variant="rail" groups={groups} />
      {checkout.recovered ? null : (
        <p className="ml-3 flex items-center gap-3 text-caption text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full border border-border-strong" />
          {copy.notRecovered}
        </p>
      )}
    </DataCard>
  )
}
