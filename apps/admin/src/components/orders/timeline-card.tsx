'use client'

import { Bell, CreditCard, MessageSquare, RotateCcw, ShoppingBag, Truck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import { api } from '@/lib/api-client'
import { formatWhen } from '@/lib/format-date'
import type { OrderDetail } from './order-detail-types'
import { buildEntries, type EntryKind, groupByDay } from './timeline-entries'

type TimelineCardProps = {
  order: OrderDetail
  onChanged: () => void
}

const ICON: Record<EntryKind, typeof Bell> = {
  order: ShoppingBag,
  payment: CreditCard,
  refund: RotateCcw,
  notification: Bell,
  shipment: Truck,
  note: MessageSquare,
}

/** Order history grouped by day, with a note composer at the top. */
export default function TimelineCard({ order, onChanged }: TimelineCardProps) {
  // Hooks
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const body = note.trim()
    if (!body) return
    setSaving(true)
    try {
      await api.orders.addNote({ orderId: order.id, body })
      setNote('')
      toast.success(copy.timeline.noteAdded)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const days = groupByDay(buildEntries(order))

  return (
    <DataCard title={copy.timeline.heading} className="print:hidden">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.timeline.notePlaceholder}
          rows={2}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="outline" disabled={saving || !note.trim()}>
            {copy.timeline.addNote}
          </Button>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-5">
        {days.map((day) => (
          <section key={day.key}>
            <p className="sticky top-14 z-10 -mx-5 bg-card px-5 py-1 text-caption text-muted-foreground">
              {day.label}
            </p>
            <ol className="relative mt-2 flex flex-col gap-4 border-l border-border pl-6">
              {day.entries.map((e) => {
                const Icon = ICON[e.kind]
                return (
                  <li key={e.id} className="relative">
                    <span
                      className={cn(
                        'absolute -left-8 top-0 flex size-6 items-center justify-center rounded-full border border-border bg-card',
                        e.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <p
                      className={cn(
                        'text-body',
                        e.kind === 'note' ? 'whitespace-pre-wrap' : 'font-medium',
                      )}
                    >
                      {e.title}
                    </p>
                    <p className="text-caption font-normal">{formatWhen(e.at)}</p>
                    {e.detail ? <p className="text-caption font-normal">{e.detail}</p> : null}
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>
    </DataCard>
  )
}
