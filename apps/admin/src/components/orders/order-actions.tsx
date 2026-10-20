'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Printer,
  RotateCcw,
  Send,
  Truck,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { orderAppActionsContent } from '@/data/order-app-actions'
import {
  type OrderFulfillmentStatus,
  type OrderMark,
  type OrderPaymentStatus,
  type OrderStatus,
  orderDetailContent,
} from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'

type OrderActionsProps = {
  status: OrderStatus
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  canRefund: boolean
  busy: boolean
  onMove: (to: OrderMark) => void
  onRefund: () => void
  /** Present while a deposit pre-order's balance is owed: "Request balance". */
  onRequestBalance?: (() => void) | undefined
  /** Present while the order is ready to ship (open, to pack, paid or COD): "Create shipment". */
  onShip?: (() => void) | undefined
  /** Installed apps' actions, grouped under each app (`useOrderAppActions`). */
  appItems?: readonly ActionItem[]
  /** Imported history: only printing and stepping between orders. */
  readOnly?: boolean
  previousId?: string | undefined
  nextId?: string | undefined
}

type Step = { label: string; to: OrderMark }

const OWED: ReadonlySet<OrderPaymentStatus> = new Set(['unpaid', 'authorized', 'partially_paid'])
const TO_PACK: ReadonlySet<OrderFulfillmentStatus> = new Set(['unfulfilled', 'partially_fulfilled'])
const ON_ITS_WAY: ReadonlySet<OrderFulfillmentStatus> = new Set([
  'fulfilled',
  'shipped',
  'partially_delivered',
])

/**
 * The one forward step for an open order: take the money, then pack, then
 * hand over. Taking the money and marking delivered earn the ink button;
 * packing stays in the menu because the Unfulfilled section already offers it.
 */
function nextStep(
  copy: typeof orderDetailContent,
  status: OrderStatus,
  payment: OrderPaymentStatus,
  fulfilment: OrderFulfillmentStatus,
): Step | undefined {
  if (status !== 'open') return undefined
  if (OWED.has(payment)) return { label: copy.actions.markPaid, to: 'paid' }
  if (TO_PACK.has(fulfilment)) {
    return { label: copy.actions.fulfil, to: 'fulfilled' }
  }
  if (ON_ITS_WAY.has(fulfilment)) {
    return { label: copy.actions.deliver, to: 'delivered' }
  }
  return undefined
}

export default function OrderActions({
  status,
  paymentStatus,
  fulfillmentStatus,
  canRefund,
  busy,
  onMove,
  onRefund,
  onRequestBalance,
  onShip,
  appItems = [],
  readOnly = false,
  previousId,
  nextId,
}: OrderActionsProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const appCopy = useCopy(orderAppActionsContent)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Render logic
  const next = readOnly ? undefined : nextStep(copy, status, paymentStatus, fulfillmentStatus)
  /* The Next step card owns the main action; the menu keeps the same move for when it is not shown. */
  const menuMove = next
  // Once the parcel is in the shopper's hands, a cancel no longer undoes anything.
  const cancellable = !readOnly && status === 'open' && fulfillmentStatus !== 'delivered'
  const refundable = !readOnly && canRefund

  /* Figma "Orders / Order detail" header: previous / next order arrows, Print and "More actions"
     (outline); the main action lives in the Next step card. */
  return (
    <div className="flex items-center gap-2 print:hidden">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.previous}
          disabled={!previousId}
          nativeButton={!previousId}
          render={previousId ? <Link href={`/orders/${previousId}`} /> : undefined}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.next}
          disabled={!nextId}
          nativeButton={!nextId}
          render={nextId ? <Link href={`/orders/${nextId}`} /> : undefined}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
      <Button variant="outline" title={copy.actions.print} onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        {copy.actions.printShort}
      </Button>
      <ActionMenu
        label={copy.actions.more}
        trigger="button"
        items={[
          {
            label: menuMove?.label ?? '',
            hidden: !menuMove,
            disabled: busy,
            onSelect: () => menuMove && onMove(menuMove.to),
          },
          {
            label: appCopy.createShipment,
            icon: Truck,
            hidden: !onShip || readOnly,
            disabled: busy,
            onSelect: onShip,
          },
          {
            label: copy.actions.refund,
            icon: RotateCcw,
            hidden: !refundable,
            disabled: busy,
            onSelect: onRefund,
          },
          {
            label: copy.payment.preorder.request,
            icon: Send,
            hidden: !onRequestBalance || readOnly,
            disabled: busy,
            onSelect: onRequestBalance,
          },
          ...(readOnly ? [] : appItems),
          {
            label: copy.actions.cancel,
            destructive: true,
            hidden: !cancellable,
            onSelect: () => setConfirmCancel(true),
          },
        ]}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={copy.cancelDialog.title}
        body={copy.cancelDialog.body}
        confirmLabel={copy.cancelDialog.confirm}
        cancelLabel={copy.cancelDialog.keep}
        onConfirm={() => onMove('cancelled')}
      />
    </div>
  )
}
