'use client'

import {
  Bell,
  CreditCard,
  MessageSquare,
  Plus,
  RotateCcw,
  ShoppingBag,
  Truck,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import ScrollSection from '@/components/layout/scroll-section'
import Timeline from '@/components/layout/timeline'
import { orderDetailContent } from '@/data/order-detail'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
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
  const copy = useCopy(orderDetailContent)
  const shipping = useCopy(shipmentPanelContent)
  const fmt = useFormat()
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
  const days = groupByDay(buildEntries(order, copy, shipping, fmt), fmt)
  const groups = days.map((day) => ({
    key: day.key,
    label: day.label,
    items: day.entries.map((e) => ({
      id: e.id,
      title: e.title,
      detail: e.detail,
      at: e.at,
      icon: ICON[e.kind],
      tone: e.tone === 'destructive' ? ('danger' as const) : ('neutral' as const),
      preserveLines: e.kind === 'note',
    })),
  }))

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
            <Plus aria-hidden="true" />
            {copy.timeline.addNote}
          </Button>
        </div>
      </form>

      <ScrollSection
        id={`order-timeline-${order.id}`}
        label={copy.timeline.heading}
        maxHeight="min(32rem, 65vh)"
        className="mt-4 [--detail-header-height:0rem]"
      >
        <Timeline groups={groups} />
      </ScrollSection>
    </DataCard>
  )
}
