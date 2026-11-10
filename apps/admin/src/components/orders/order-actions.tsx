'use client'

import {
  Bell,
  CancelCircle,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheck,
  Copy,
  ExternalLink,
  FileEdit,
  FileText,
  LinkIcon,
  Package,
  PackageCheck,
  Pause,
  Pencil,
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
import { orderDetailContent } from '@/data/order-detail'
import { orderEditContent } from '@/data/order-edit'
import { orderHoldContent } from '@/data/order-hold'
import {
  type OrderFulfillmentStatus,
  type OrderMark,
  type OrderPaymentStatus,
  type OrderStatus,
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
  /** "Send order link": the customer's link to their order page; undefined hides it. */
  onSendOrderLink?: (() => void) | undefined
  /** "View order status page": the shopper's own page for this order, in a new tab. */
  onViewStatusPage?: (() => void) | undefined
  /** Undo a "Mark as delivered" pressed by mistake; shown only on a delivered order. */
  onMarkNotDelivered?: (() => void) | undefined
  /** Starts a new draft from this order ("Duplicate order"); undefined hides it. */
  onDuplicate?: (() => void) | undefined
  /** "Archive order": off the working tabs; undefined hides it (no right, or already archived). */
  onArchive?: (() => void) | undefined
  /** Opens "Cancel order" (reason, restock, notify, refund); undefined once it cannot be cancelled. */
  onCancel?: (() => void) | undefined
  /** Opens "Hold fulfilment" (#1011); undefined when it cannot be held (or already is). */
  onHold?: (() => void) | undefined
  /** Opens the order edit page; undefined when the order cannot be edited. */
  onEdit?: (() => void) | undefined
  /** Where the order's invoices are on the page ("View invoices"); undefined hides it. */
  invoicesHref?: string | undefined
  /** The print view of this order's packing slip (Settings › Printed documents). */
  printHref: string
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
  onSendOrderLink,
  onViewStatusPage,
  onMarkNotDelivered,
  onDuplicate,
  onArchive,
  onCancel,
  onHold,
  onEdit,
  invoicesHref,
  printHref,
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
  const editCopy = useCopy(orderEditContent)
  const holdCopy = useCopy(orderHoldContent)
  const [confirm, setConfirm] = useState<'cancelShipment' | null>(null)

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
      {onEdit ? (
        <Button variant="outline" title={editCopy.action} disabled={busy} onClick={onEdit}>
          <Pencil aria-hidden="true" />
          {editCopy.short}
        </Button>
      ) : null}
      {refundable ? (
        <Button variant="outline" disabled={busy} onClick={onRefund}>
          <RotateCcw aria-hidden="true" />
          {copy.actions.refund}
        </Button>
      ) : null}
      <Button
        variant="outline"
        title={copy.actions.print}
        onClick={() => window.open(printHref, '_blank', 'noopener')}
      >
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
            label: copy.actions.invoices,
            icon: FileText,
            hidden: !invoicesHref,
            href: invoicesHref,
          },
          {
            label: appCopy.createShipment,
            icon: Truck,
            hidden: !onShip || readOnly,
            disabled: busy,
            onSelect: onShip,
          },
          {
            label: holdCopy.action,
            icon: Pause,
            hidden: !onHold || readOnly,
            disabled: busy,
            onSelect: onHold,
          },
          // Next to the fulfilment actions, not at the bottom under the apps (owner, 2 Nov):
          // Refund is its own button beside Edit, as on Shopify.
          {
            label: copy.actions.cancel,
            icon: CancelCircle,
            destructive: true,
            hidden: !onCancel,
            disabled: busy,
            onSelect: onCancel,
          },
          {
            label: copy.payment.preorder.request,
            icon: Send,
            hidden: !onRequestBalance || readOnly,
            disabled: busy,
            separatorBefore: true,
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
            label: copy.actions.sendOrderLink,
            icon: LinkIcon,
            hidden: !onSendOrderLink || readOnly,
            disabled: busy,
            onSelect: onSendOrderLink,
          },
          {
            label: copy.actions.markNotDelivered,
            icon: RotateCcw,
            hidden: !onMarkNotDelivered || fulfillmentStatus !== 'delivered' || readOnly,
            disabled: busy,
            onSelect: onMarkNotDelivered,
          },
          {
            label: copy.actions.viewStatusPage,
            icon: ExternalLink,
            hidden: !onViewStatusPage,
            onSelect: onViewStatusPage,
          },
          {
            label: list.row.cancelShipment,
            icon: CancelCircle,
            destructive: true,
            hidden: !onCancelShipment || readOnly,
            disabled: busy,
            onSelect: () => setConfirm('cancelShipment'),
          },
          {
            label: copy.duplicate.action,
            icon: FileEdit,
            hidden: !onDuplicate,
            disabled: busy,
            separatorBefore: true,
            onSelect: onDuplicate,
          },
          {
            label: list.row.copyNumber,
            icon: Copy,
            hidden: orderNumber === undefined,
            separatorBefore: !onDuplicate,
            onSelect: handleCopyNumber,
          },
          {
            label: list.row.sameCustomer,
            icon: Users,
            hidden: !customerEmail,
            href: `${routes.orders.list()}?query=${encodeURIComponent(customerEmail ?? '')}`,
          },
          // The order's own action, not an app's: it sits above the Apps group.
          {
            label: copy.archive.action,
            hidden: !onArchive,
            onSelect: onArchive,
          },
          ...(readOnly ? [] : appItems).map((item, i) => ({
            ...item,
            heading: i === 0 ? list.row.apps : undefined,
          })),
        ]}
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
