'use client'

import type { Tracking } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { Bell, CreditCard, MessageSquare, RotateCcw, ShoppingBag, Truck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import { shipmentPanelContent } from '@/data/shipping'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { type OrderDetail, when } from './order-detail-types'

type TimelineCardProps = {
  order: OrderDetail
  onChanged: () => void
}

type Kind = 'order' | 'payment' | 'refund' | 'notification' | 'shipment' | 'note'

type Entry = {
  id: string
  at: Date
  kind: Kind
  title: string
  detail?: string | undefined
  tone?: 'destructive' | undefined
}

const ICON: Record<Kind, typeof Bell> = {
  order: ShoppingBag,
  payment: CreditCard,
  refund: RotateCcw,
  notification: Bell,
  shipment: Truck,
  note: MessageSquare,
}

/** Every system event plus staff notes, newest first. Sources have no shared table, so this is assembled client-side. */
function buildEntries(order: OrderDetail): Entry[] {
  const t = copy.timeline
  const entries: Entry[] = [
    { id: 'placed', at: new Date(order.placedAt), kind: 'order', title: t.placed },
  ]

  for (const e of order.paymentEvents) {
    entries.push({
      id: `pe-${e.id}`,
      at: new Date(e.receivedAt),
      kind: 'payment',
      title: t.paymentEvent(e.type),
      detail: e.error ?? undefined,
      tone: e.status === 'failed' ? 'destructive' : undefined,
    })
  }

  for (const r of order.refunds) {
    entries.push({
      id: `rf-${r.id}`,
      at: new Date(r.createdAt),
      kind: 'refund',
      title: t.refund(formatPaise(r.amountPaise)),
      detail: [copy.payment.refundStatus[r.status] ?? r.status, r.reason]
        .filter(Boolean)
        .join(', '),
      tone: r.status === 'failed' ? 'destructive' : undefined,
    })
  }

  for (const n of order.notifications) {
    const template = t.templates[n.template] ?? n.template
    const failed = n.status === 'failed'
    entries.push({
      id: `nt-${n.id}`,
      at: new Date(n.createdAt),
      kind: 'notification',
      title: failed
        ? t.notificationFailed(template, n.channel)
        : t.notification(template, n.channel),
      detail: failed ? (n.error ?? undefined) : n.to,
      tone: failed ? 'destructive' : undefined,
    })
  }

  const tracking = (order.shipment?.tracking ?? null) as Tracking | null
  if (order.shipment) {
    entries.push({
      id: `sh-${order.shipment.id}`,
      at: new Date(order.shipment.createdAt),
      kind: 'shipment',
      title: t.shipmentBooked,
      detail: `${shipmentPanelContent.waybill} ${order.shipment.waybill}`,
    })
    for (const e of tracking?.events ?? []) {
      entries.push({
        id: `se-${e.at}-${e.status}`,
        at: new Date(e.at),
        kind: 'shipment',
        title: t.shipment(shipmentPanelContent.status[e.status] ?? e.status),
        detail: [e.location, e.description].filter(Boolean).join(': ') || undefined,
      })
    }
  }

  for (const n of order.notes) {
    entries.push({
      id: `no-${n.id}`,
      at: new Date(n.createdAt),
      kind: 'note',
      title: n.body,
      detail: n.author ?? undefined,
    })
  }

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime())
}

/** Order history with a note composer at the top. */
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
  const entries = buildEntries(order)

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
      <ol className="relative mt-4 flex flex-col gap-4 border-l border-border pl-6">
        {entries.map((e) => {
          const Icon = ICON[e.kind]
          return (
            <li key={e.id} className="relative">
              <span
                className={`absolute top-0 -left-8 flex size-6 items-center justify-center rounded-full border border-border bg-card ${
                  e.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'
                }`}
                aria-hidden="true"
              >
                <Icon className="size-3.5" />
              </span>
              <p
                className={`text-body ${e.kind === 'note' ? 'whitespace-pre-wrap' : 'font-medium'}`}
              >
                {e.title}
              </p>
              <p className="text-caption">{when(e.at)}</p>
              {e.detail ? <p className="text-caption">{e.detail}</p> : null}
            </li>
          )
        })}
      </ol>
    </DataCard>
  )
}
