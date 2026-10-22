'use client'

import {
  Bell,
  CancelCircle,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheck,
  Copy,
  Package,
  PackageCheck,
  Printer,
  RotateCcw,
  Send,
  Truck,
  Users,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { orderAppActionsContent } from '@/data/order-app-actions'
import {
  type OrderFulfillmentStatus,
  type OrderMark,
  type OrderPaymentStatus,
  type OrderStatus,
  orderDetailContent,
  ordersContent,
} from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { MOVE_ACTION, nextOrderMove } from '@/lib/order-next-move'
import { routes } from '@/lib/routes'

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
  /** Cancels the booked courier shipment (asks first); undefined when there is none to cancel. */
  onCancelShipment?: (() => void) | undefined
  /** Nudges the customer about an unmatched UPI or bank transfer. */
  onSendReminder?: (() => void) | undefined
  /** The order's number, for "Copy order number". */
  orderNumber?: number | undefined
  /** The customer's email, for "Orders from this customer". */
  customerEmail?: string | null | undefined
  /** Installed apps' actions, grouped under each app (`useOrderAppActions`). */
  appItems?: readonly ActionItem[]
  /** Imported history: only printing and stepping between orders. */
  readOnly?: boolean
  previousId?: string | undefined
  nextId?: string | undefined
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
  onCancelShipment,
  onSendReminder,
  orderNumber,
  customerEmail,
  appItems = [],
  readOnly = false,
  previousId,
  nextId,
}: OrderActionsProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const list = useCopy(ordersContent)
  const appCopy = useCopy(orderAppActionsContent)
  const [confirm, setConfirm] = useState<'cancel' | 'cancelShipment' | null>(null)

  // Event handlers
  const handleCopyNumber = async () => {
    if (orderNumber === undefined) return
    await navigator.clipboard.writeText(`#${orderNumber}`).catch(() => undefined)
    toast.success(list.row.numberCopied)
  }

  // Render logic
  const move = readOnly ? undefined : nextOrderMove(status, paymentStatus, fulfillmentStatus)
  /* The Next step card owns the main action; the menu keeps the same move for when it is not shown. */
  const menuMove = move ? { label: copy.actions[MOVE_ACTION[move]], to: move } : undefined
  // Once the parcel is in the shopper's hands, a cancel no longer undoes anything.
  const cancellable = !readOnly && status === 'open' && fulfillmentStatus !== 'delivered'
  const refundable = !readOnly && canRefund
  const moveIcon =
    menuMove?.to === 'paid' ? CircleCheck : menuMove?.to === 'fulfilled' ? PackageCheck : Package

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
            icon: moveIcon,
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
            label: list.row.cancelShipment,
            icon: CancelCircle,
            hidden: !onCancelShipment || readOnly,
            disabled: busy,
            onSelect: () => setConfirm('cancelShipment'),
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
          {
            label: copy.payment.transfer.send,
            icon: Bell,
            hidden: !onSendReminder || readOnly,
            disabled: busy,
            onSelect: onSendReminder,
          },
          {
            label: list.row.copyNumber,
            icon: Copy,
            hidden: orderNumber === undefined,
            separatorBefore: true,
            onSelect: handleCopyNumber,
          },
          {
            label: list.row.sameCustomer,
            icon: Users,
            hidden: !customerEmail,
            href: `${routes.orders.list()}?query=${encodeURIComponent(customerEmail ?? '')}`,
          },
          ...(readOnly ? [] : appItems).map((item, i) => ({
            ...item,
            heading: i === 0 ? list.row.apps : undefined,
          })),
          {
            label: copy.actions.cancel,
            icon: CancelCircle,
            destructive: true,
            hidden: !cancellable,
            separatorBefore: true,
            onSelect: () => setConfirm('cancel'),
          },
        ]}
      />

      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={copy.cancelDialog.title}
        body={copy.cancelDialog.body}
        confirmLabel={copy.cancelDialog.confirm}
        cancelLabel={copy.cancelDialog.keep}
        onConfirm={() => onMove('cancelled')}
      />
      <ConfirmDialog
        open={confirm === 'cancelShipment'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={list.row.cancelShipmentTitle}
        body={list.row.cancelShipmentBody}
        confirmLabel={list.row.cancelShipmentConfirm}
        cancelLabel={list.row.keepShipment}
        onConfirm={() => onCancelShipment?.()}
      />
    </div>
  )
}
