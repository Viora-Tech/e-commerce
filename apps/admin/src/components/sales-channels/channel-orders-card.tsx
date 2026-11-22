'use client'

import type { ChannelOrder } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import StatusLabel from '@/components/status/status-label'
import SimpleTable from '@/components/table/simple-table'
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
        <Button
          variant="link"
          size="xs"
          nativeButton={false}
          render={<Link href={routes.orders.list()} />}
          className="h-auto px-0"
        >
          {card.viewInOrders}
        </Button>
      }
    >
      {orders.length === 0 ? (
        <EmptyState variant="plain" size="sm" body={empty} />
      ) : (
        <SimpleTable
          className="min-w-[40rem]"
          columns={[
            { key: 'order', label: copy.order },
            ...(showChannel ? [{ key: 'channel', label: copy.channel }] : []),
            { key: 'customer', label: copy.customer },
            { key: 'total', label: copy.total, align: 'end' as const },
            { key: 'payment', label: copy.payment },
            { key: 'fulfilment', label: copy.fulfilment },
          ]}
        >
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
              <td className="px-4 py-2.5 text-right tabular-nums">{format.money(o.totalPaise)}</td>
              <td className="px-4 py-2.5">
                <StatusLabel kind="orderPayment" value={o.paymentStatus} variant="soft" />
              </td>
              <td className="px-4 py-2.5">
                <StatusLabel kind="fulfilment" value={o.fulfillmentStatus} variant="soft" />
              </td>
            </tr>
          ))}
        </SimpleTable>
      )}
    </DataCard>
  )
}
