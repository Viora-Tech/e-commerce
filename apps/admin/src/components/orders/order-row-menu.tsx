'use client'

import { canStaffCancel } from '@commerce/core/order-edit-rules'
import { permissions } from '@commerce/core/permissions'
import {
  Archive,
  Bell,
  CancelCircle,
  CircleCheck,
  Copy,
  FileEdit,
  Package,
  PackageCheck,
  RotateCcw,
  Undo,
} from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import TagInput from '@/components/fields/tag-input'
import type { ActionItem } from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import CancelOrderDialog from '@/components/orders/cancel-order-dialog'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import type { SendChannel } from '@/components/orders/reminder-channel-picker'
import SendMessageDialog, { type CustomMessage } from '@/components/orders/send-message-dialog'
import { useDuplicateOrder } from '@/components/orders/use-duplicate-order'
import RowMenu from '@/components/table/row-menu'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import {
  canRemindToPay,
  MOVE_ACTION,
  nextOrderMove,
  type OrderMove,
  orderUndos,
} from '@/lib/order-next-move'
import { routes } from '@/lib/routes'

type OrderRowMenuProps = {
  order: {
    id: string
    number: number
    status: string
    paymentStatus: string
    paymentMethod: string | null
    fulfillmentStatus: string | null
    tags: string[] | null
    /** Set while the order is archived (#1007): the menu offers Unarchive instead of Archive. */
    archivedAt?: string | Date | null
    /** A read-only import: shipping, moves and cancel happen on its page, after taking it over. */
    /** The latest booking's courier status; a cancelled or finished one cannot be cancelled. */
    deliveryStatus?: string | null | undefined
    importedFrom?: string | null
  }
  /** The row's own items (open, new tab, same customer). */
  items: readonly ActionItem[]
  /** Installed apps' actions for this order; shown last under one "Apps" heading. */
  appItems: readonly ActionItem[]
  /** Every tag used on the store's orders, offered while typing. */
  tagSuggestions: readonly string[]
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

type Dialog = 'cancelShipment' | 'addTags' | 'removeTags' | 'remind' | null

const SHIPPABLE = ['unfulfilled', 'partially_fulfilled']
/** Booked with a courier but not yet in the shopper's hands. */
const BOOKED = ['fulfilled', 'shipped']
/** A courier status after which the booking can no longer be cancelled from the list. */
const ENDED_DELIVERY = new Set(['cancelled', 'delivered', 'rto', 'rto_delivered'])
const PAID = ['paid', 'partially_paid']

const MOVE_ICON = { paid: CircleCheck, fulfilled: PackageCheck, delivered: Package } as const

/**
 * The ⋯ menu on an order row, Shopify style: open, the order's next move (paid, fulfilled,
 * delivered), a payment reminder, shipping, cancel, tags, copy the number, and the installed
 * apps last under one "Apps" heading. Each item shows only when it applies; cancel opens the
 * order page's own "Cancel order" (same call, same rules, same approval), cancel shipment asks
 * first, and the reminder opens the "Review email" step.
 */
export default function OrderRowMenu({
  order,
  items,
  appItems,
  tagSuggestions,
  onChanged,
}: OrderRowMenuProps) {
  // Hooks
  const router = useRouter()
  const detail = useCopy(orderDetailContent)
  const list = useCopy(ordersContent)
  const shipping = useCopy(shipmentPanelContent)
  const duplicateOrder = useDuplicateOrder()
  const { hasPermission } = usePermissions()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [cancelling, setCancelling] = useState<OrderDetail | null>(null)
  const [tags, setTags] = useState<string[]>([])

  // Event handlers
  const handleMove = async (to: OrderMove) => {
    // Packing asks for the courier and tracking: it happens on the order page's pack form.
    if (to === 'fulfilled') {
      router.push(`${routes.orders.detail(order.id)}?fulfil=1`)
      return
    }
    // As on the order page, "Mark as paid" asks how the money came in (cash, UPI, bank).
    if (to === 'paid') {
      router.push(`${routes.orders.detail(order.id)}?collect=1`)
      return
    }
    try {
      await api.orders.setStatus({ id: order.id, status: to })
      toast.success(detail.moved(list.marks[to].toLowerCase()))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
    }
  }

  const handleSendReminder = async (custom: CustomMessage | undefined, channel?: SendChannel) => {
    try {
      await api.orders.sendPaymentReminder({ orderId: order.id, custom, channel })
      toast.success(detail.payment.transfer.sentToast)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
    }
  }

  /* The order page's undo actions, the same calls and rules (the API refuses what cannot be
     undone and says why). */
  const handleUndo = async (call: () => Promise<unknown>, done: string) => {
    try {
      await call()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
    }
  }

  const handleCopyNumber = async () => {
    await navigator.clipboard.writeText(`#${order.number}`).catch(() => undefined)
    toast.success(list.row.numberCopied)
  }

  const handleReminderChat = () => {
    void api.orders.notePaymentReminderChat({ orderId: order.id }).then(onChanged, () => undefined)
  }

  // The row only has a summary: the dialog needs the full order (payments, refundable amount).
  const handleOpenCancel = async () => {
    try {
      const full = await api.orders.get({ id: order.id })
      if (full) setCancelling(full)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
    }
  }

  const handleCancelled = () => {
    setCancelling(null)
    onChanged()
  }

  const handleCancelShipment = async () => {
    try {
      const full = await api.orders.get({ id: order.id })
      const shipmentId = full?.shipment?.id
      if (!shipmentId) return void toast.error(list.row.noShipment)
      await api.orders.cancelShipment({ shipmentId })
      toast.success(shipping.cancelled)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
    }
  }

  const handleArchive = async (archived: boolean) => {
    try {
      await api.orders.archiveMany({ ids: [order.id], archived })
      toast.success(archived ? detail.archive.archived : detail.archive.unarchived)
      onChanged()
    } catch {
      toast.error(detail.archive.failed)
    }
  }

  const handleSaveTags = async () => {
    const lower = new Set(tags.map((t) => t.toLowerCase()))
    const next =
      dialog === 'addTags'
        ? [
            ...current,
            ...tags.filter((t) => !current.some((c) => c.toLowerCase() === t.toLowerCase())),
          ]
        : current.filter((t) => !lower.has(t.toLowerCase()))
    try {
      await api.orders.setTags({ id: order.id, tags: next })
      toast.success(list.row.tagsSaved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : list.bulk.failed)
    }
  }

  const openTags = (kind: 'addTags' | 'removeTags') => {
    setTags([])
    setDialog(kind)
  }

  // Render logic
  // The order page asks to take an import over before shipping or cancelling it; the row menu
  // follows the same rule instead of offering those straight away (audit #47).
  const open = order.status === 'open' && !order.importedFrom
  const current = order.tags ?? []
  const fulfilment = order.fulfillmentStatus ?? 'unfulfilled'
  const undos = orderUndos(order)
  const canShip =
    open &&
    SHIPPABLE.includes(fulfilment) &&
    (PAID.includes(order.paymentStatus) || order.paymentMethod === 'cod')
  // Same rule as the order page: a booking that is still live (not cancelled, delivered or back).
  const canCancelShipment =
    open && BOOKED.includes(fulfilment) && !ENDED_DELIVERY.has(order.deliveryStatus ?? '')
  // The order page's rule (not shipped yet) and grant, so both offer the same cancel.
  const cancellable =
    open &&
    canStaffCancel({ importedFrom: null, status: order.status, fulfillmentStatus: fulfilment }) &&
    hasPermission(permissions.ORDERS_CANCEL)
  const move = order.importedFrom
    ? null
    : nextOrderMove(order.status, order.paymentStatus, order.fulfillmentStatus)
  const remindable = !order.importedFrom && canRemindToPay(order)

  const canArchive = hasPermission(permissions.ORDERS_WRITE)
  const tagging = dialog === 'addTags' || dialog === 'removeTags'

  return (
    <>
      <RowMenu
        items={[
          ...items,
          {
            label: move ? detail.actions[MOVE_ACTION[move]] : '',
            icon: move ? MOVE_ICON[move] : undefined,
            hidden: !move,
            separatorBefore: true,
            onSelect: () => move && handleMove(move),
          },
          {
            label: detail.payment.transfer.send,
            icon: Bell,
            hidden: !remindable,
            onSelect: () => setDialog('remind'),
          },
          {
            label: list.row.createShipment,
            href: routes.orders.ship(order.id),
            hidden: !canShip,
            separatorBefore: true,
          },
          {
            label: list.row.cancelShipment,
            icon: CancelCircle,
            destructive: true,
            hidden: !canCancelShipment,
            onSelect: () => setDialog('cancelShipment'),
          },
          {
            label: detail.actions.markNotShipped,
            icon: RotateCcw,
            hidden: !undos.unfulfil || !hasPermission(permissions.ORDERS_FULFIL),
            onSelect: () =>
              handleUndo(
                () => api.orders.markNotShipped({ id: order.id }),
                detail.actions.markedNotShipped,
              ),
          },
          {
            label: detail.actions.markNotDelivered,
            icon: RotateCcw,
            hidden: !undos.undeliver || !hasPermission(permissions.ORDERS_WRITE),
            onSelect: () =>
              handleUndo(
                () => api.orders.markNotDelivered({ id: order.id }),
                detail.actions.markedNotDelivered,
              ),
          },
          {
            label: detail.actions.restore,
            icon: RotateCcw,
            hidden: !undos.restore || !hasPermission(permissions.ORDERS_CANCEL),
            onSelect: () =>
              handleUndo(() => api.orders.restore({ id: order.id }), detail.actions.restored),
          },
          {
            label: detail.actions.cancel,
            icon: CancelCircle,
            destructive: true,
            hidden: !cancellable,
            onSelect: handleOpenCancel,
          },
          {
            label: list.row.addTags,
            separatorBefore: true,
            onSelect: () => openTags('addTags'),
          },
          {
            label: list.row.removeTags,
            hidden: current.length === 0,
            onSelect: () => openTags('removeTags'),
          },
          {
            // Archive works on imports and cancelled orders too, as on the order page (#6).
            label: order.archivedAt ? list.row.unarchive : detail.archive.action,
            icon: order.archivedAt ? Undo : Archive,
            hidden: !canArchive,
            onSelect: () => handleArchive(!order.archivedAt),
          },
          {
            label: list.row.copyNumber,
            icon: Copy,
            onSelect: handleCopyNumber,
          },
          {
            label: duplicateOrder.label,
            icon: FileEdit,
            hidden: !duplicateOrder.allowed,
            onSelect: () => duplicateOrder.duplicate(order.id),
          },
          ...appItems.map((item, i) => ({
            ...item,
            heading: i === 0 ? list.row.apps : undefined,
          })),
        ]}
      />
      <CancelOrderDialog
        order={cancelling}
        stopPropagation
        onClose={() => setCancelling(null)}
        onDone={handleCancelled}
      />
      <ConfirmDialog
        open={dialog === 'cancelShipment'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={list.row.cancelShipmentTitle}
        body={list.row.cancelShipmentBody}
        confirmLabel={list.row.cancelShipmentConfirm}
        cancelLabel={list.row.keepShipment}
        stopPropagation
        onConfirm={handleCancelShipment}
      />
      <ConfirmDialog
        open={tagging}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'removeTags' ? list.row.removeTagsTitle : list.row.addTagsTitle}
        body={list.row.tagsBody}
        confirmLabel={list.row.tagsSave}
        cancelLabel={list.row.tagsCancel}
        tone="default"
        confirmDisabled={tags.length === 0}
        stopPropagation
        onConfirm={handleSaveTags}
      >
        <TagInput
          id={`order-tags-${order.id}`}
          tags={tags}
          suggestions={dialog === 'removeTags' ? current : tagSuggestions}
          onChange={setTags}
        />
      </ConfirmDialog>
      <SendMessageDialog
        orderId={dialog === 'remind' ? order.id : null}
        template="payment_reminder"
        stopPropagation
        onSend={handleSendReminder}
        chooseChannel={{ onChatOpened: handleReminderChat }}
        onClose={() => setDialog(null)}
      />
    </>
  )
}
