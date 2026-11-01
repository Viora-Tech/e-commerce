'use client'

import { canEditOrder, canHoldFulfillment, canStaffCancel } from '@commerce/core/order-edit-rules'
import { permissions } from '@commerce/core/permissions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { type OrderActionGroup, readyToShip } from '@/apps/order-actions'
import { ADMIN_APPS } from '@/apps/registry'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import { orderDetailContent } from '@/data/order-detail'
import { type OrderMark, ordersContent } from '@/data/orders'
import { paymentRulesContent } from '@/data/payment-rules'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { orderChannel } from '@/lib/order-channel'
import { routes } from '@/lib/routes'
import CancelOrderDialog from './cancel-order-dialog'
import CollectPaymentDialog from './collect-payment-dialog'
import CourierOrdersCard from './courier-orders-card'
import CustomerCard from './customer-card'
import DeliveryRouteCard from './delivery-route-card'
import HoldFulfillmentDialog from './hold-fulfillment-dialog'
import ImportedOrderCard from './imported-order-card'
import LineItemsCard from './line-items-card'
import { openOrderStatusPage } from './open-status-page'
import OrderActions from './order-actions'
import OrderArchivedNotice from './order-archived-notice'
import {
  isOfflineMethod,
  type OrderDetail,
  type OrderPayment,
  paymentStatus,
  primaryPayment,
  refundedTotal,
  unfulfilledLines,
} from './order-detail-types'
import OrderHeader from './order-header'
import OrderHoldBanner from './order-hold-banner'
import OrderNextStep from './order-next-step'
import { nextStepKind } from './order-next-step-kind'
import OrderPageFrame from './order-page-frame'
import OrderReturnsCard from './order-returns-card'
import ParcelsCard from './parcels-card'
import PaymentCard from './payment-card'
import ProfitCard from './profit-card'
import RefundDialog from './refund-dialog'
import SalesChannelCard from './sales-channel-card'
import SendMessageDialog from './send-message-dialog'
import ShipmentPanel from './shipment-panel'
import TagsCard from './tags-card'
import TimelineCard from './timeline-card'
import UnfulfilledCard from './unfulfilled-card'
import { useDuplicateOrder } from './use-duplicate-order'
import { useOrderAppActions } from './use-order-app-actions'
import { useOrderMessages } from './use-order-messages'

/** The GST invoices app's card, drawn high in the side column and linked from "More actions". */
const INVOICES_APP = 'gst-invoices'
const INVOICES_ANCHOR = 'order-invoices'

type OrderViewProps = {
  order: OrderDetail
  /** Installed apps that add a card to this page, by plugin id. */
  appCards?: string[]
  /** Installed apps' order actions for "More actions" (`api.apps.orderActions`). */
  appActions?: OrderActionGroup[]
  /** Back link override, e.g. to Shipments when the order was opened from there. */
  back?: { label: string; href: string }
}

export default function OrderView({ order, appCards = [], appActions = [], back }: OrderViewProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const listCopy = useCopy(ordersContent)
  const { order: captureCopy } = useCopy(paymentRulesContent)
  const shippingCopy = useCopy(shipmentPanelContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const apps = useOrderAppActions(appActions, () => router.refresh())
  const duplicateOrder = useDuplicateOrder()
  const automation = useRunAutomation('order', appCards.includes('automations'))
  const [busy, setBusy] = useState(false)
  const [refunding, setRefunding] = useState<OrderPayment | null>(null)
  const [fulfilling, setFulfilling] = useState(false)
  /** The hand-sent message whose "Review email" dialog is open. */
  const [reviewing, setReviewing] = useState<
    'balance_request' | 'payment_reminder' | 'order_link' | null
  >(null)
  const [collecting, setCollecting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [holding, setHolding] = useState(false)
  const messages = useOrderMessages(order.id, setBusy, () => router.refresh())

  // Helpers
  const appCard = (id: string) => {
    const Card = ADMIN_APPS[id]?.OrderCard
    return Card ? <Card key={id} orderId={order.id} /> : null
  }
  const refresh = () => router.refresh()
  const openRefund = () => setRefunding(payment?.status === 'captured' ? payment : null)
  const closeAndRefresh = (close: () => void) => () => {
    close()
    refresh()
  }

  // Event handlers
  /* The next-step bar opens the Unfulfilled card in place; bring it into view. */
  const handleOpenFulfil = () => {
    setFulfilling(true)
    requestAnimationFrame(() =>
      document
        .getElementById('fulfil-items')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const handleMove = async (to: OrderMark) => {
    // "Mark as paid" asks how the money came in, the same as Collect payment.
    if (to === 'paid' && canCollect) {
      setCollecting(true)
      return
    }
    setBusy(true)
    try {
      await api.orders.setStatus({ id: order.id, status: to })
      toast.success(copy.moved(listCopy.marks[to].toLowerCase()))
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : listCopy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleArchive = async (archived: boolean) => {
    setBusy(true)
    try {
      await api.orders.archiveMany({ ids: [order.id], archived })
      toast.success(archived ? copy.archive.archived : copy.archive.unarchived)
      refresh()
    } catch {
      toast.error(copy.archive.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleViewStatusPage = () => openOrderStatusPage(order.id, copy.actions.statusPageFailed)
  /** "Capture payment" (#150): take the money a manual-capture checkout only authorised. */
  const handleCapture = async (p: OrderPayment) => {
    setBusy(true)
    try {
      await api.orders.capture({ paymentId: p.id })
      toast.success(captureCopy.captured)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : captureCopy.failed)
    } finally {
      setBusy(false)
    }
  }
  /** The merchant opened the reminder in their own WhatsApp: put it on the timeline. */
  const handleReminderChat = () => {
    void api.orders.notePaymentReminderChat({ orderId: order.id }).then(refresh, () => undefined)
  }
  /** Courier calls can fail; the message is the app's wording from the API, shown as a toast. */
  const handleCourier = async <T,>(run: () => Promise<T>, done: (result: T) => string) => {
    setBusy(true)
    try {
      toast.success(done(await run()))
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Courier request failed')
    } finally {
      setBusy(false)
    }
  }

  const handleShip = () => router.push(routes.orders.ship(order.id))
  const handleRefreshTracking = () =>
    shipmentId &&
    handleCourier(
      () => api.orders.refreshTracking({ shipmentId }),
      () => 'Tracking updated',
    )
  const handleCancelShipment = () =>
    shipmentId &&
    handleCourier(
      () => api.orders.cancelShipment({ shipmentId }),
      () => shippingCopy.cancelled,
    )

  // Render logic
  // #1012: "Ships from" leads only while a parcel waits on a transfer; archive works on imports too.
  const parcelsFirst = order.parcels.some((p) => p.needsTransfer && p.status === 'open')
  const soldThrough = orderChannel(order.attribution)
  const payment = primaryPayment(order.payments)
  const pay = paymentStatus(payment, order.refunds)
  const remaining = refunding
    ? refunding.amountPaise - refundedTotal(order.refunds, refunding.id)
    : 0
  // Imported history is a record: nothing on it can be collected or packed. A refund can still be
  // recorded by hand (the old platform took the money), never sent through a gateway here.
  const readOnly = Boolean(order.importedFrom)
  const canRefund = order.payments.some(
    (p) => p.status === 'captured' && refundedTotal(order.refunds, p.id) < p.amountPaise,
  )
  const shipmentId = order.shipment?.id
  const live = order.status !== 'cancelled' && !readOnly
  const owed = order.balance.balancePaise
  const canCollect = live && owed > 0
  const canFulfil = live && unfulfilledLines(order).length > 0
  const offline = isOfflineMethod(order.paymentMethod)
  // A deposit pre-order past its deposit, balance still owed: the customer can be asked for it.
  const balanceOwed =
    live &&
    order.checkoutPaidAt !== null &&
    !order.balancePaidAt &&
    (order.balanceDuePaise ?? 0) > 0
  // Both open the "Review email" dialog first; its Send runs the handler.
  const requestBalance = balanceOwed ? () => setReviewing('balance_request') : undefined
  // A transfer the merchant has not matched yet: the customer can be nudged.
  const sendReminder =
    live && !order.checkoutPaidAt && order.paymentMethod === 'manual'
      ? () => setReviewing('payment_reminder')
      : undefined

  // A placed order the customer can be reached on: its order page link can be sent.
  const sendOrderLink =
    live && (order.email || order.phone) ? () => setReviewing('order_link') : undefined

  const awaitingTransfer = live && !order.checkoutPaidAt && order.paymentMethod === 'manual'
  const stepKind = nextStepKind(order, { readOnly, canCollect, canFulfil, awaitingTransfer })
  const canFulfilOrders = hasPermission(permissions.ORDERS_FULFIL)
  // A held order books nothing (#1011): the banner's "Release hold" comes first.
  const canShip = !readOnly && !order.hold && readyToShip(order) && canFulfilOrders
  const canHold = !order.hold && canHoldFulfillment(order) && canFulfilOrders
  // An imported order still open can be cancelled too (the server takes it over first).
  const canCancel = canStaffCancel(order) && hasPermission(permissions.ORDERS_CANCEL)
  const canEdit = canEditOrder(order) && hasPermission(permissions.ORDERS_WRITE)
  const canArchive = hasPermission(permissions.ORDERS_WRITE)
  const canCapture = live && hasPermission(permissions.ORDERS_REFUND)

  return (
    <OrderPageFrame
      header={
        <OrderHeader
          order={order}
          back={back}
          actions={(n) => (
            <OrderActions
              printHref={routes.orders.packingSlips([order.id])}
              status={order.status}
              paymentStatus={order.paymentStatus}
              fulfillmentStatus={order.fulfillmentStatus}
              canRefund={canRefund}
              busy={busy || apps.busy}
              onMove={handleMove}
              onRefund={openRefund}
              onRequestBalance={requestBalance}
              onShip={canShip ? handleShip : undefined}
              onCancelShipment={
                /* Only while the courier still takes the cancel (before pickup or manifest). */
                shipmentId && order.shipment?.cancelBlock === null
                  ? handleCancelShipment
                  : undefined
              }
              onSendReminder={sendReminder}
              onSendOrderLink={sendOrderLink}
              onViewStatusPage={handleViewStatusPage}
              onDuplicate={
                duplicateOrder.allowed && !readOnly
                  ? () => duplicateOrder.duplicate(order.id)
                  : undefined
              }
              onCancel={canCancel ? () => setCancelling(true) : undefined}
              onHold={canHold ? () => setHolding(true) : undefined}
              onEdit={canEdit ? () => router.push(routes.orders.edit(order.id)) : undefined}
              invoicesHref={appCards.includes(INVOICES_APP) ? `#${INVOICES_ANCHOR}` : undefined}
              orderNumber={order.number}
              customerEmail={order.email}
              onArchive={canArchive && !order.archivedAt ? () => handleArchive(true) : undefined}
              appItems={[
                ...automation.items([order.id], { runsLink: true }),
                ...apps.items('detail', order, [order.id]),
              ]}
              readOnly={readOnly}
              previousId={n?.previous?.id}
              nextId={n?.next?.id}
            />
          )}
        />
      }
      // An archived order leads with its notice and shows no next step (#4).
      nextStep={
        order.archivedAt ? (
          <OrderArchivedNotice
            archivedAt={order.archivedAt}
            busy={busy}
            onUnarchive={canArchive ? () => handleArchive(false) : undefined}
          />
        ) : order.hold ? (
          <OrderHoldBanner
            orderId={order.id}
            hold={order.hold}
            canRelease={canFulfilOrders}
            onChanged={refresh}
          />
        ) : stepKind ? (
          <OrderNextStep
            order={order}
            kind={stepKind}
            busy={busy}
            onCollect={() => setCollecting(true)}
            onShip={handleShip}
            onFulfil={handleOpenFulfil}
            onDelivered={() => handleMove('delivered')}
            onSendReminder={sendReminder}
          />
        ) : null
      }
      main={
        <>
          <ImportedOrderCard
            order={order}
            canTakeOver={hasPermission(permissions.ORDERS_WRITE)}
            onChanged={refresh}
          />
          {readOnly ? null : (
            <UnfulfilledCard
              order={order}
              fulfilling={fulfilling}
              onFulfil={order.hold ? undefined : () => setFulfilling(true)}
              onCancel={() => setFulfilling(false)}
              onDone={closeAndRefresh(() => setFulfilling(false))}
            />
          )}
          {readOnly || !parcelsFirst ? null : <ParcelsCard order={order} />}
          <LineItemsCard
            order={order}
            payment={pay}
            unfulfilledShown={!readOnly && order.status !== 'cancelled'}
            editHref={canEdit ? routes.orders.edit(order.id) : undefined}
          />
          <PaymentCard
            order={order}
            onRefund={canRefund ? setRefunding : undefined}
            onCapture={canCapture ? handleCapture : undefined}
            onCollect={canCollect ? () => setCollecting(true) : undefined}
            onRequestBalance={requestBalance}
            onSendReminder={sendReminder}
            busy={busy}
          />
          {readOnly || parcelsFirst ? null : <ParcelsCard order={order} />}
          {readOnly ? null : (
            <div id="order-shipment" className="scroll-mt-6">
              <ShipmentPanel
                orderStatus={order.status === 'open' ? order.fulfillmentStatus : order.status}
                shipment={order.shipment}
                busy={busy}
                onBook={handleShip}
                onRefresh={handleRefreshTracking}
                onChanged={refresh}
              />
            </div>
          )}
          <div id="order-returns" className="scroll-mt-6">
            {/* Keyed on the order's progress: it reads eligibility once, so marking the order
                delivered on this page has to load it again, or "Start a return" finds no card. */}
            <OrderReturnsCard
              key={`${order.status}:${order.fulfillmentStatus}`}
              orderId={order.id}
              readOnly={readOnly}
              onChanged={refresh}
            />
          </div>
          <MetafieldsCard ownerType="order" ownerId={order.id} hideWhenEmpty />
          <div id="order-timeline" className="scroll-mt-6">
            <TimelineCard order={order} onChanged={refresh} />
          </div>
        </>
      }
      side={
        <>
          {soldThrough ? (
            <SalesChannelCard
              channel={soldThrough}
              cameFrom={order.attribution?.referrer ?? order.attribution?.source ?? null}
              campaign={order.attribution?.campaign ?? null}
            />
          ) : null}
          <CustomerCard order={order} />
          {/* Invoices sit right under the customer, where staff look for them (issue 920). */}
          {appCards.includes(INVOICES_APP) ? (
            <div id={INVOICES_ANCHOR} className="scroll-mt-6">
              {appCard(INVOICES_APP)}
            </div>
          ) : null}
          <CourierOrdersCard
            orderId={order.id}
            rows={order.courierOrders}
            canRetry={!readOnly && hasPermission(permissions.ORDERS_WRITE)}
            onChanged={refresh}
          />
          {order.shipping?.delivery ? (
            <DeliveryRouteCard
              delivery={order.shipping.delivery}
              chargedPaise={order.shippingPaise}
              bookingChargePaise={order.shipment?.courierChargePaise ?? null}
              showMargin={hasPermission(permissions.ANALYTICS_READ)}
            />
          ) : null}
          {readOnly ? null : (
            <ProfitCard
              orderId={order.id}
              shipment={
                order.shipment
                  ? {
                      id: order.shipment.id,
                      courierChargePaise: order.shipment.courierChargePaise,
                    }
                  : null
              }
            />
          )}
          {appCards.filter((id) => id !== INVOICES_APP).map(appCard)}
          <TagsCard orderId={order.id} tags={order.tags} onChanged={refresh} />
        </>
      }
    >
      <RunAutomationDialog
        subjectType="order"
        ids={automation.target}
        onClose={automation.close}
        onDone={refresh}
      />
      <SendMessageDialog
        orderId={reviewing ? order.id : null}
        template={reviewing ?? 'payment_reminder'}
        onSend={
          reviewing === 'balance_request'
            ? messages.requestBalance
            : reviewing === 'order_link'
              ? messages.sendOrderLink
              : messages.sendReminder
        }
        chooseChannel={
          reviewing === 'payment_reminder' ? { onChatOpened: handleReminderChat } : undefined
        }
        onClose={() => setReviewing(null)}
      />
      <HoldFulfillmentDialog
        orderId={holding ? order.id : null}
        onClose={() => setHolding(false)}
        onDone={closeAndRefresh(() => setHolding(false))}
      />
      <CancelOrderDialog
        order={cancelling ? order : null}
        onClose={() => setCancelling(false)}
        onDone={closeAndRefresh(() => setCancelling(false))}
      />
      <RefundDialog
        payment={refunding}
        remainingPaise={remaining}
        imported={readOnly}
        onClose={() => setRefunding(null)}
        onDone={closeAndRefresh(() => setRefunding(null))}
      />
      <CollectPaymentDialog
        order={collecting ? order : null}
        balancePaise={owed}
        gateway={!offline}
        payHref={`/orders/${order.id}`}
        onClose={() => setCollecting(false)}
        onDone={closeAndRefresh(() => setCollecting(false))}
      />
    </OrderPageFrame>
  )
}
