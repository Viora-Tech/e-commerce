'use client'

import type { ChannelOrder } from '@commerce/core'
import Link from 'next/link'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import OrderChip from '@/components/orders/order-chip'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ChannelOrdersCardProps = {
  title: string
  empty: string
  orders: ChannelOrder[]
  /** Show which channel each order came from (Agentic sales lists several agents). */
  showChannel?: boolean
}

/** Figma "Recent orders from …": the latest channel orders, each opening in Orders. */
export default function ChannelOrdersCard({
  title,
  empty,
  orders,
  showChannel = false,
}: ChannelOrdersCardProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.orders)
  const card = useCopy(salesChannelsContent.overview)
  const names = useCopy(salesChannelsContent.agents)
  const social = useCopy(salesChannelsContent.social)
  const format = useFormat()

  // Render logic
  const nameOf = (o: ChannelOrder) =>
    o.channel in names
      ? names[o.channel as keyof typeof names].name
      : social[o.channel as keyof typeof social].name

  return (
    <DataCard
      title={title}
      flush
      action={
        <KitButton variant="linkSm" href={routes.orders.list()}>
          {card.viewInOrders}
        </KitButton>
      }
    >
      {orders.length === 0 ? (
        <EmptyState variant="plain" size="sm" body={empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-body">
            <thead>
              <tr className="border-b border-border text-left text-caption text-muted-foreground">
                <th className="px-4 py-2 font-medium">{copy.order}</th>
                {showChannel ? <th className="px-4 py-2 font-medium">{copy.channel}</th> : null}
                <th className="px-4 py-2 font-medium">{copy.customer}</th>
                <th className="px-4 py-2 text-right font-medium">{copy.total}</th>
                <th className="px-4 py-2 font-medium">{copy.payment}</th>
                <th className="px-4 py-2 font-medium">{copy.fulfilment}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-row-hover">
                  <td className="px-4 py-2.5">
                    <Link
                      href={routes.orders.detail(o.id)}
                      className="font-medium text-ink-strong hover:underline"
                    >
                      #{o.number}
                    </Link>
                    <p className="text-caption text-muted-foreground">{format.when(o.placedAt)}</p>
                  </td>
                  {showChannel ? (
                    <td className="px-4 py-2.5">
                      <StatusChip variant="outline">{nameOf(o)}</StatusChip>
                    </td>
                  ) : null}
                  <td className="px-4 py-2.5">{o.customer ?? copy.guest}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {format.money(o.totalPaise)}
                  </td>
                  <td className="px-4 py-2.5">
                    <OrderChip kind="orderPayment" value={o.paymentStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <OrderChip kind="fulfilment" value={o.fulfillmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  )
}
