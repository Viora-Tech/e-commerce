'use client'

import type { Tracking } from '@commerce/core'
import {
  CheckIcon,
  CircleCheck,
  Clock,
  Copy,
  PackageOpen,
  Send,
  Truck,
  Undo,
  X,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import NextStepBanner, { type NextStepTone } from '@/components/layout/next-step-banner'
import { orderDetailContent } from '@/data/order-detail'
import { orderNextStepContent } from '@/data/order-next-step'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { methodLabel, type OrderDetail, unfulfilledLines } from './order-detail-types'
import type { NextStepKind } from './order-next-step-kind'
import OrderTransitSteps from './order-transit-steps'

type OrderNextStepProps = {
  order: OrderDetail
  kind: NextStepKind
  busy: boolean
  onCollect: () => void
  /** Opens the Create shipment flow (pick the courier, book, print the label). */
  onShip: () => void
  /** Packs items by hand, without a courier booking. */
  onFulfil: () => void
  onDelivered: () => void
  /** Present while a transfer is waiting to be matched; sends the customer a nudge. */
  onSendReminder?: (() => void) | undefined
}

/* Work to do is the action banner; delivered is done, cancelled is closed. */
const TONE: Record<NextStepKind, NextStepTone> = {
  upi: 'action',
  collect: 'action',
  ship: 'action',
  transit: 'action',
  done: 'done',
  cancelled: 'closed',
}

const PLAIN = ''
const SHORT_DATE = { day: 'numeric', month: 'short' } as const

/** The order's next step (Figma "Order · Next step"): one card, driven by where the order really is. */
export default function OrderNextStep({
  order,
  kind,
  busy,
  onCollect,
  onShip,
  onFulfil,
  onDelivered,
  onSendReminder,
}: OrderNextStepProps) {
  // Hooks
  const copy = useCopy(orderNextStepContent)
  const detail = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Event handlers
  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(copy.transit.linkCopied)
    } catch {
      toast.error(detail.customer.copy(copy.transit.copyLink.toLowerCase()))
    }
  }

  // Render logic
  const owed = fmt.money(order.balance.balancePaise)
  const shipment = order.shipment && order.shipment.status !== 'cancelled' ? order.shipment : null
  const tracking = (shipment?.tracking ?? null) as Tracking | null
  const name = (order.shippingAddress?.name || order.customer?.name || '').split(' ')[0] ?? ''
  const method = order.paymentMethod ? methodLabel(order.paymentMethod, detail) : ''
  const toPack = unfulfilledLines(order).reduce((n, l) => n + l.remaining, 0)
  const sentAt = order.paymentReminderSentAt ? new Date(order.paymentReminderSentAt) : null

  let eyebrow: string = copy.eyebrow.next
  let title = ''
  let body = ''
  let icon: ReactNode = <Clock aria-hidden />
  let actions: ReactNode = null
  let extra: ReactNode = null

  if (kind === 'upi') {
    title = copy.upi.title
    body = copy.upi.body(owed, fmt.ago(order.placedAt))
    actions = (
      <>
        {onSendReminder ? (
          <Button variant="outline" className={PLAIN} onClick={onSendReminder} disabled={busy}>
            <Send aria-hidden="true" />
            {copy.upi.resend}
          </Button>
        ) : null}
        <Button onClick={onCollect} disabled={busy}>
          <CheckIcon aria-hidden />
          {copy.upi.markPaid}
        </Button>
      </>
    )
    extra = sentAt ? (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3 text-body">
        <span className="text-muted-foreground">{copy.upi.reminder}</span>
        <span className="text-ink-strong">
          {detail.payment.transfer.reminderSent(fmt.ago(sentAt))}
        </span>
      </div>
    ) : null
  } else if (kind === 'collect') {
    title = copy.collect.title(owed)
    body = copy.collect.body
    icon = <CircleCheck aria-hidden />
    actions = (
      <Button onClick={onCollect} disabled={busy}>
        <CheckIcon aria-hidden />
        {copy.collect.action}
      </Button>
    )
  } else if (kind === 'ship') {
    title = copy.ship.title(toPack)
    body =
      order.balance.balancePaise > 0 && order.paymentMethod === 'cod'
        ? copy.ship.cod(owed)
        : copy.ship.paid(method || detail.customer.guest.toLowerCase())
    icon = <Truck aria-hidden />
    actions = (
      <>
        <Button variant="outline" className={PLAIN} onClick={onFulfil} disabled={busy}>
          <PackageOpen aria-hidden />
          {copy.ship.action}
        </Button>
        <Button onClick={onShip} disabled={busy}>
          <Truck aria-hidden />
          {copy.ship.create}
        </Button>
      </>
    )
  } else if (kind === 'transit') {
    eyebrow = copy.eyebrow.progress
    title = copy.transit.title(name || copy.transit.fallbackName)
    body = shipment
      ? [
          shipment.provider,
          copy.transit.tracking(shipment.waybill),
          tracking?.expectedDate
            ? copy.transit.expected(fmt.pattern(tracking.expectedDate, SHORT_DATE))
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : copy.transit.noTracking
    icon = <Truck aria-hidden />
    const trackingUrl = shipment?.trackingUrl
    actions = (
      <>
        {trackingUrl ? (
          <Button variant="outline" className={PLAIN} onClick={() => handleCopyLink(trackingUrl)}>
            <Copy aria-hidden />
            {copy.transit.copyLink}
          </Button>
        ) : null}
        <Button onClick={onDelivered} disabled={busy}>
          <CheckIcon aria-hidden />
          {copy.transit.delivered}
        </Button>
      </>
    )
    extra = shipment ? <OrderTransitSteps shipment={shipment} /> : null
  } else if (kind === 'done') {
    eyebrow = copy.eyebrow.done
    title = order.deliveredAt
      ? copy.done.title(fmt.pattern(order.deliveredAt, SHORT_DATE))
      : copy.done.titleNoDate
    body = copy.done.body(
      name || copy.transit.fallbackName,
      order.paymentMethod === 'cod' && order.paymentStatus === 'paid'
        ? fmt.money(order.totalPaise)
        : null,
    )
    icon = <CircleCheck aria-hidden />
    actions = (
      <Button
        variant="outline"
        className={PLAIN}
        render={<a href="#order-returns" />}
        nativeButton={false}
      >
        <Undo aria-hidden="true" />
        {copy.done.startReturn}
      </Button>
    )
  } else {
    eyebrow = copy.eyebrow.closed
    title = copy.cancelled.title
    body = copy.cancelled.body
    icon = <X aria-hidden />
    actions = (
      <Button
        variant="outline"
        className={PLAIN}
        render={<a href="#order-timeline" />}
        nativeButton={false}
      >
        {copy.cancelled.history}
      </Button>
    )
  }

  return (
    <NextStepBanner
      tone={TONE[kind]}
      eyebrow={eyebrow}
      title={title}
      body={body}
      icon={icon}
      actions={actions}
      extra={extra}
    />
  )
}
