import type { Tracking } from '@commerce/core'
import { readManualCollection } from '@commerce/core/manual-payments'
import type { notificationsSettingsContent } from '@/data/notifications'
import type { orderDetailContent } from '@/data/order-detail'
import type { shipmentPanelContent } from '@/data/shipping'
import type { Formatters } from '@/lib/format'
import { dayKey } from '@/lib/format-date'
import { methodLabel, type OrderDetail } from './order-detail-types'

export type EntryKind = 'order' | 'payment' | 'refund' | 'notification' | 'shipment' | 'note'

export type Entry = {
  id: string
  at: Date
  kind: EntryKind
  title: string
  detail?: string | undefined
  tone?: 'destructive' | undefined
}

export type EntryDay = {
  key: string
  label: string
  entries: Entry[]
}

/** Every system event plus staff notes. Sources have no shared table, so this is assembled here. */
export function buildEntries(
  order: OrderDetail,
  copy: typeof orderDetailContent,
  shipping: typeof shipmentPanelContent,
  fmt: Formatters,
  names: Pick<typeof notificationsSettingsContent, 'messages' | 'channels'>,
): Entry[] {
  const t = copy.timeline
  const entries: Entry[] = [
    { id: 'placed', at: new Date(order.placedAt), kind: 'order', title: t.placed },
  ]

  // What happened on the old platform before the move (audit #20), in its own words.
  for (const [i, e] of (order.importMeta?.history ?? []).entries()) {
    // Shopify's own bookkeeping ("Unknown event Order#tax_finalization_…") means nothing here (#14).
    if (e.message.startsWith('Unknown event')) continue
    entries.push({
      id: `ih-${i}`,
      at: new Date(e.at),
      kind: 'order',
      title: e.message,
      detail: t.fromImport,
    })
  }

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

  // Money the merchant recorded by hand: how, when and by whom.
  for (const p of order.payments) {
    const collected = readManualCollection(p.checkoutSession)
    if (!collected) continue
    const received = collected.receivedOn
      ? new Date(`${collected.receivedOn}T00:00:00+05:30`)
      : null
    entries.push({
      id: `mp-${p.id}`,
      at: new Date(collected.recordedAt ?? received ?? p.createdAt),
      kind: 'payment',
      title: t.markedPaid(fmt.money(p.amountPaise), methodLabel(collected.method, copy)),
      detail:
        t.markedPaidDetail({
          reference: collected.reference,
          receivedOn: received ? fmt.date(received) : undefined,
          by: collected.recordedBy,
        }) || undefined,
    })
  }

  for (const r of order.refunds) {
    entries.push({
      id: `rf-${r.id}`,
      at: new Date(r.createdAt),
      kind: 'refund',
      title: t.refund(fmt.money(r.amountPaise)),
      detail: [copy.payment.refundStatus[r.status] ?? r.status, r.reason]
        .filter(Boolean)
        .join(', '),
      tone: r.status === 'failed' ? 'destructive' : undefined,
    })
  }

  // Plain names, never codes: "Refund confirmation sent by email", not "refund_issued sent via
  // platform_email" (audit #16).
  for (const n of order.notifications) {
    const template = names.messages[n.template]?.name ?? t.templates[n.template] ?? n.template
    const channel = names.channels[n.channel] ?? n.channel
    const failed = n.status === 'failed'
    entries.push({
      id: `nt-${n.id}`,
      at: new Date(n.createdAt),
      kind: 'notification',
      title: failed ? t.notificationFailed(template, channel) : t.notification(template, channel),
      detail: failed ? (n.error ?? undefined) : n.to,
      tone: failed ? 'destructive' : undefined,
    })
  }

  if (order.fulfilledAt) {
    entries.push({
      id: 'fulfilled',
      at: new Date(order.fulfilledAt),
      kind: 'shipment',
      title: t.fulfilled,
    })
  }
  if (order.deliveredAt) {
    entries.push({
      id: 'delivered',
      at: new Date(order.deliveredAt),
      kind: 'shipment',
      title: t.deliveredByHand,
    })
  }

  const tracking = (order.shipment?.tracking ?? null) as Tracking | null
  if (order.shipment) {
    entries.push({
      id: `sh-${order.shipment.id}`,
      at: new Date(order.shipment.createdAt),
      kind: 'shipment',
      title: order.shipment.canEditTracking ? t.trackingAdded : t.shipmentBooked,
      detail: `${shipping.waybill} ${order.shipment.waybill}`,
    })
    for (const e of tracking?.events ?? []) {
      entries.push({
        id: `se-${e.at}-${e.status}`,
        at: new Date(e.at),
        kind: 'shipment',
        title: t.shipment(shipping.status[e.status] ?? e.status),
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

/** Newest day first, entries inside a day newest first, the way Shopify reads. */
export function groupByDay(entries: Entry[], fmt: Formatters, now = new Date()): EntryDay[] {
  const days: EntryDay[] = []
  for (const entry of entries) {
    const key = dayKey(entry.at)
    const last = days.at(-1)
    if (last?.key === key) last.entries.push(entry)
    else days.push({ key, label: fmt.day(entry.at, now), entries: [entry] })
  }
  return days
}
