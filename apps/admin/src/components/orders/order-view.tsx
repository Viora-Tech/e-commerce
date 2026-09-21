'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import StatusPill from '@/components/layout/status-pill'
import { orderDetailContent as copy, ORDER_STATUS_TONE, ordersContent } from '@/data/orders'
import { shipmentPanelContent } from '@/data/shipping'
import { api } from '@/lib/api-client'
import CustomerCard from './customer-card'
import LineItemsCard from './line-items-card'
import OrderActions from './order-actions'
import {
  fulfilmentPill,
  type OrderDetail,
  type OrderPayment,
  type OrderStatus,
  paymentPill,
  primaryPayment,
  refundedTotal,
  when,
} from './order-detail-types'
import PackingSlip from './packing-slip'
import PaymentCard from './payment-card'
import RefundDialog from './refund-dialog'
import ShipmentPanel from './shipment-panel'
import TagsCard from './tags-card'
import TimelineCard from './timeline-card'

type OrderViewProps = {
  order: OrderDetail
}

export default function OrderView({ order }: OrderViewProps) {
  // Hooks
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refunding, setRefunding] = useState<OrderPayment | null>(null)

  // Helpers
  const refresh = () => router.refresh()
  const openRefund = () => setRefunding(payment?.status === 'captured' ? payment : null)

  // Event handlers
  const handleMove = async (to: OrderStatus) => {
    setBusy(true)
    try {
      await api.orders.setStatus({ id: order.id, status: to })
      toast.success(copy.moved(ordersContent.status[to].toLowerCase()))
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
  const pay = paymentPill(payment, order.refunds)
  const ful = fulfilmentPill(order.status)
  const remaining = refunding
    ? refunding.amountPaise - refundedTotal(order.refunds, refunding.id)
    : 0
  const canRefund = order.payments.some(
    (p) => p.status === 'captured' && refundedTotal(order.refunds, p.id) < p.amountPaise,
  )

  const shipmentId = order.shipment?.id

  return (
    <PageBody>
      <div className="print:hidden">
        <PageHeader
          title={copy.title(order.number)}
          subtitle={copy.placed(when(order.placedAt))}
          breadcrumbs={[{ label: copy.back, href: '/orders' }, { label: `#${order.number}` }]}
          actions={
            <OrderActions
              status={order.status}
              canRefund={canRefund}
              busy={busy}
              onMove={handleMove}
              onRefund={openRefund}
            />
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {order.status === 'cancelled' ? (
            <StatusPill tone={ORDER_STATUS_TONE.cancelled}>
              {ordersContent.status.cancelled}
            </StatusPill>
          ) : null}
          <StatusPill tone={pay.tone}>{pay.label}</StatusPill>
          <StatusPill tone={ful.tone}>{ful.label}</StatusPill>
        </div>
      </div>

      <div className="print:hidden">
        <PageColumns
          main={
            <>
              <LineItemsCard order={order} />
              <PaymentCard order={order} onRefund={canRefund ? setRefunding : undefined} />
              <ShipmentPanel
                orderStatus={order.status}
                shipment={order.shipment}
                busy={busy}
                onBook={handleBook}
                onRefresh={handleRefreshTracking}
                onCancel={handleCancelShipment}
              />
              <TimelineCard order={order} onChanged={refresh} />
            </>
          }
          side={
            <>
              <CustomerCard order={order} />
              <TagsCard orderId={order.id} tags={order.tags} onChanged={refresh} />
            </>
          }
        />
      </div>

      <PackingSlip order={order} />
      <RefundDialog
        payment={refunding}
        remainingPaise={remaining}
        onClose={() => setRefunding(null)}
        onDone={() => {
          setRefunding(null)
          refresh()
        }}
      />
    </PageBody>
  )
}
