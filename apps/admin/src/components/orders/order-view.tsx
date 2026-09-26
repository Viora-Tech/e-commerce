'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ADMIN_APPS } from '@/apps/registry'
import DetailLayout from '@/components/layout/detail-layout'
import { orderDetailContent as copy, type OrderMark, ordersContent } from '@/data/orders'
import { shipmentPanelContent } from '@/data/shipping'
import { api } from '@/lib/api-client'
import CollectPaymentDialog from './collect-payment-dialog'
import CustomerCard from './customer-card'
import FulfilDialog from './fulfil-dialog'
import ImportedOrderCard from './imported-order-card'
import LineItemsCard from './line-items-card'
import OrderActionBar from './order-action-bar'
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
import OrderReturnsCard from './order-returns-card'
import PackingSlip from './packing-slip'
import PaymentCard from './payment-card'
import RefundDialog from './refund-dialog'
import ShipmentPanel from './shipment-panel'
import TagsCard from './tags-card'
import TimelineCard from './timeline-card'
import UnfulfilledCard from './unfulfilled-card'

type OrderViewProps = {
  order: OrderDetail
  /** Installed apps that add a card to this page, by plugin id. */
  appCards?: string[]
}

export default function OrderView({ order, appCards = [] }: OrderViewProps) {
  // Hooks
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refunding, setRefunding] = useState<OrderPayment | null>(null)
  const [fulfilling, setFulfilling] = useState(false)
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
    setBusy(true)
    try {
      await api.orders.setStatus({ id: order.id, status: to })
      toast.success(copy.moved(ordersContent.marks[to].toLowerCase()))
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ordersContent.bulk.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleRequestBalance = async () => {
    setBusy(true)
    try {
      await api.orders.requestBalance({ orderId: order.id })
      toast.success(copy.payment.preorder.requestedToast)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ordersContent.bulk.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleSendReminder = async () => {
    setBusy(true)
    try {
      await api.orders.sendPaymentReminder({ orderId: order.id })
      toast.success(copy.payment.transfer.sentToast)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ordersContent.bulk.failed)
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

  const handleBook = () =>
    handleCourier(
      () => api.orders.createShipment({ orderId: order.id }),
      (s) => shipmentPanelContent.booked(s.waybill),
    )
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
      () => shipmentPanelContent.cancelled,
    )

  // Render logic
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
  const requestBalance = balanceOwed ? handleRequestBalance : undefined
  // A transfer the merchant has not matched yet: the customer can be nudged.
  const sendReminder =
    live && !order.checkoutPaidAt && order.paymentMethod === 'manual'
      ? handleSendReminder
      : undefined

  /* One next step, in the order a merchant works: take the money, then pack it. */
  const nextAction = canCollect
    ? { label: copy.actions.collect, onClick: () => setCollecting(true) }
    : canFulfil
      ? { label: copy.actions.fulfilItems, onClick: () => setFulfilling(true) }
      : null

  return (
    <DetailLayout
      className="print:hidden"
      header={
        <OrderHeader
          order={order}
          actions={(n) => (
            <OrderActions
              status={order.status}
              paymentStatus={order.paymentStatus}
              fulfillmentStatus={order.fulfillmentStatus}
              canRefund={canRefund}
              busy={busy}
              onMove={handleMove}
              onRefund={openRefund}
              onRequestBalance={requestBalance}
              readOnly={readOnly}
              previousId={n?.previous?.id}
              nextId={n?.next?.id}
            />
          )}
        />
      }
      main={
        <>
          <ImportedOrderCard order={order} />
          {readOnly ? null : <UnfulfilledCard order={order} onFulfil={() => setFulfilling(true)} />}
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
            <ShipmentPanel
              orderStatus={order.status === 'open' ? order.fulfillmentStatus : order.status}
              shipment={order.shipment}
              busy={busy}
              onBook={handleBook}
              onRefresh={handleRefreshTracking}
              onCancel={handleCancelShipment}
            />
          )}
          <OrderReturnsCard orderId={order.id} readOnly={readOnly} onChanged={refresh} />
          <TimelineCard order={order} onChanged={refresh} />
        </>
      }
      side={
        <>
          <CustomerCard order={order} />
          {appCards.map((id) => {
            const Card = ADMIN_APPS[id]?.OrderCard
            return Card ? <Card key={id} orderId={order.id} /> : null
          })}
          <TagsCard orderId={order.id} tags={order.tags} onChanged={refresh} />
        </>
      }
    >
      <OrderActionBar action={nextAction} orderNumber={order.number} busy={busy} />

      <PackingSlip order={order} />
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
    </DetailLayout>
  )
}
