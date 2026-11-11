'use client'

import { ADMIN_APPS } from '@/apps/registry'
import { orderChannel } from '@/lib/order-channel'
import CourierOrdersCard from './courier-orders-card'
import CustomerCard from './customer-card'
import DeliveryRouteCard from './delivery-route-card'
import type { OrderDetail } from './order-detail-types'
import ProfitCard from './profit-card'
import SalesChannelCard from './sales-channel-card'
import TagsCard from './tags-card'

type OrderSideColumnProps = {
  order: OrderDetail
  /** Installed apps that add a card to the order page, by plugin id. */
  appCards: string[]
  /** An imported order: no profit card. */
  readOnly: boolean
  /** Orders: edit, and not imported: a failed courier order can be retried. */
  canRetry: boolean
  /** Analytics: read: the delivery route shows the shipping margin. */
  showMargin: boolean
  onChanged: () => void
}

/** The GST invoices app's card, drawn high in the side column and linked from "More actions". */
export const INVOICES_APP = 'gst-invoices'
export const INVOICES_ANCHOR = 'order-invoices'

function appCard(id: string, orderId: string) {
  const Card = ADMIN_APPS[id]?.OrderCard
  return Card ? <Card key={id} orderId={orderId} /> : null
}

/** The order page's side column: channel, customer, invoices, couriers, route, profit, apps, tags. */
export default function OrderSideColumn({
  order,
  appCards,
  readOnly,
  canRetry,
  showMargin,
  onChanged,
}: OrderSideColumnProps) {
  // Render logic
  const soldThrough = orderChannel(order.attribution)

  return (
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
          {appCard(INVOICES_APP, order.id)}
        </div>
      ) : null}
      <CourierOrdersCard
        orderId={order.id}
        rows={order.courierOrders}
        canRetry={canRetry}
        onChanged={onChanged}
      />
      {order.shipping?.delivery ? (
        <DeliveryRouteCard
          delivery={order.shipping.delivery}
          chargedPaise={order.shippingPaise}
          bookingChargePaise={order.shipment?.courierChargePaise ?? null}
          showMargin={showMargin}
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
      {appCards.filter((id) => id !== INVOICES_APP).map((id) => appCard(id, order.id))}
      <TagsCard orderId={order.id} tags={order.tags} onChanged={onChanged} />
    </>
  )
}
