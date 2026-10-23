'use client'

import { permissions } from '@commerce/core/permissions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { type OrderActionGroup, readyToShip } from '@/apps/order-actions'
import { ADMIN_APPS } from '@/apps/registry'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import { type OrderMark, orderDetailContent, ordersContent } from '@/data/orders'
import { shipmentPanelContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { orderChannel } from '@/lib/order-channel'
import { routes } from '@/lib/routes'
import CollectPaymentDialog from './collect-payment-dialog'
import CustomerCard from './customer-card'
import FulfilDialog from './fulfil-dialog'
import ImportedOrderCard from './imported-order-card'
import LineItemsCard from './line-items-card'
import OrderActions from './order-actions'
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
import OrderNextStep from './order-next-step'
import { nextStepKind } from './order-next-step-kind'
import OrderPageFrame from './order-page-frame'
import OrderReturnsCard from './order-returns-card'
import PackingSlip from './packing-slip'
import ParcelsCard from './parcels-card'
import PaymentCard from './payment-card'
import ProfitCard from './profit-card'
import RefundDialog from './refund-dialog'
import SalesChannelCard from './sales-channel-card'
import SendMessageDialog, { type CustomMessage } from './send-message-dialog'
import ShipmentPanel from './shipment-panel'
import TagsCard from './tags-card'
import TimelineCard from './timeline-card'
import UnfulfilledCard from './unfulfilled-card'
import { useOrderAppActions } from './use-order-app-actions'

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
  const shippingCopy = useCopy(shipmentPanelContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const apps = useOrderAppActions(appActions, () => router.refresh())
  const automation = useRunAutomation('order', appCards.includes('automations'))
  const [busy, setBusy] = useState(false)
  const [refunding, setRefunding] = useState<OrderPayment | null>(null)
  const [fulfilling, setFulfilling] = useState(false)
  /** The hand-sent message whose "Review email" dialog is open. */
  const [reviewing, setReviewing] = useState<'balance_request' | 'payment_reminder' | null>(null)
  const [collecting, setCollecting] = useState(false)

  // Helpers
  const refresh = () => router.refresh()
  const openRefund = () => setRefunding(payment?.status === 'captured' ? payment : null)
  const closeAndRefresh = (close: () => void) => () => {
    close()
    refresh()
  }

  // Event handlers
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
  const handleRequestBalance = async (custom?: CustomMessage) => {
    setBusy(true)
    try {
      await api.orders.requestBalance({ orderId: order.id, custom })
      toast.success(copy.payment.preorder.requestedToast)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : listCopy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleSendReminder = async (custom?: CustomMessage) => {
    setBusy(true)
    try {
      await api.orders.sendPaymentReminder({ orderId: order.id, custom })
      toast.success(copy.payment.transfer.sentToast)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : listCopy.bulk.failed)
    } finally {
      setBusy(false)
    }
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
  const soldThrough = orderChannel(order.attribution)
  const payment = primaryPayment(order.payments)
  const pay = paymentStatus(payment, order.refunds)
  const remaining = refunding
    ? refunding.amountPaise - refundedTotal(order.refunds, refunding.id)
    : 0
  // Imported history is a record: nothing on it can be collected, packed or refunded.
  const readOnly = Boolean(order.importedFrom)
  const canRefund =
    !readOnly &&
    order.payments.some(
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

  const awaitingTransfer = live && !order.checkoutPaidAt && order.paymentMethod === 'manual'
  const stepKind = nextStepKind(order, { readOnly, canCollect, canFulfil, awaitingTransfer })
  const canShip = !readOnly && readyToShip(order) && hasPermission(permissions.ORDERS_FULFIL)

  return (
    <OrderPageFrame
      header={
        <OrderHeader
          order={order}
          back={back}
          actions={(n) => (
            <OrderActions
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
                shipmentId && ['fulfilled', 'shipped'].includes(order.fulfillmentStatus)
                  ? handleCancelShipment
                  : undefined
              }
              onSendReminder={sendReminder}
              orderNumber={order.number}
              customerEmail={order.email}
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
      nextStep={
        stepKind ? (
          <OrderNextStep
            order={order}
            kind={stepKind}
            busy={busy}
            onCollect={() => setCollecting(true)}
            onShip={handleShip}
            onFulfil={() => setFulfilling(true)}
            onDelivered={() => handleMove('delivered')}
            onSendReminder={sendReminder}
          />
        ) : null
      }
      main={
        <>
          <ImportedOrderCard order={order} />
          {readOnly ? null : <UnfulfilledCard order={order} onFulfil={() => setFulfilling(true)} />}
          {readOnly ? null : <ParcelsCard order={order} />}
          <LineItemsCard
            order={order}
            payment={pay}
            unfulfilledShown={!readOnly && order.status !== 'cancelled'}
          />
          <PaymentCard
            order={order}
            onRefund={canRefund ? setRefunding : undefined}
            onCollect={canCollect ? () => setCollecting(true) : undefined}
            onRequestBalance={requestBalance}
            onSendReminder={sendReminder}
            busy={busy}
          />
          {readOnly ? null : (
            <div id="order-shipment" className="scroll-mt-6">
              <ShipmentPanel
                orderStatus={order.status === 'open' ? order.fulfillmentStatus : order.status}
                shipment={order.shipment}
                busy={busy}
                onBook={handleShip}
                onRefresh={handleRefreshTracking}
                onCancel={handleCancelShipment}
              />
            </div>
          )}
          <div id="order-returns" className="scroll-mt-6">
            <OrderReturnsCard orderId={order.id} readOnly={readOnly} onChanged={refresh} />
          </div>
          <MetafieldsCard ownerType="order" ownerId={order.id} />
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
          {appCards.map((id) => {
            const Card = ADMIN_APPS[id]?.OrderCard
            return Card ? <Card key={id} orderId={order.id} /> : null
          })}
          <TagsCard orderId={order.id} tags={order.tags} onChanged={refresh} />
        </>
      }
    >
      <PackingSlip order={order} />
      <RunAutomationDialog
        subjectType="order"
        ids={automation.target}
        onClose={automation.close}
        onDone={refresh}
      />
      <SendMessageDialog
        orderId={reviewing ? order.id : null}
        template={reviewing ?? 'payment_reminder'}
        onSend={reviewing === 'balance_request' ? handleRequestBalance : handleSendReminder}
        onClose={() => setReviewing(null)}
      />
      <RefundDialog
        payment={refunding}
        remainingPaise={remaining}
        onClose={() => setRefunding(null)}
        onDone={closeAndRefresh(() => setRefunding(null))}
      />
      <FulfilDialog
        order={fulfilling ? order : null}
        onClose={() => setFulfilling(false)}
        onDone={closeAndRefresh(() => setFulfilling(false))}
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
