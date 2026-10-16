'use client'

import type { Tracking } from '@commerce/core'
import { CheckIcon, CircleCheck, Clock, Copy, PackageOpen, Truck, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { orderNextStepContent } from '@/data/order-next-step'
import { orderDetailContent } from '@/data/orders'
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

/* Blue while there is work to do, green once delivered, grey when closed. */
/* Figma "Order · Next step": an open step is the raised glass card (glass/raised, radius 16);
   done is the success tint, cancelled a quiet muted card. */
const TONE: Record<NextStepKind, string> = {
  upi: 'border-transparent surface-glass',
  collect: 'border-transparent surface-glass',
  ship: 'border-transparent surface-glass',
  transit: 'border-transparent surface-glass',
  done: 'border-success-border bg-success-soft',
  cancelled: 'border-border bg-muted/60',
}

const EYEBROW_TONE: Record<NextStepKind, string> = {
  upi: 'text-primary',
  collect: 'text-primary',
  ship: 'text-primary',
  transit: 'text-primary',
  done: 'text-success',
  cancelled: 'text-muted-foreground',
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
      order.paymentMethod === 'cod' ? fmt.money(order.totalPaise) : null,
    )
    icon = <CircleCheck aria-hidden />
    actions = (
      <Button
        variant="outline"
        className={PLAIN}
        render={<a href="#order-returns" />}
        nativeButton={false}
      >
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
    <section
      aria-label={eyebrow}
      className={cn('flex flex-col gap-4 rounded-xl border p-4 md:px-5 print:hidden', TONE[kind])}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft shadow-input [&_svg]:size-5',
              kind === 'done' ? 'border-transparent bg-success text-white' : 'text-primary',
              kind === 'cancelled' && 'text-muted-foreground',
            )}
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                'font-mono text-[0.6875rem] leading-4 font-medium tracking-[0.06em] uppercase',
                EYEBROW_TONE[kind],
              )}
            >
              {eyebrow}
            </span>
            <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em] text-ink-strong">
              {title}
            </h2>
            <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {extra}
    </section>
  )
}
