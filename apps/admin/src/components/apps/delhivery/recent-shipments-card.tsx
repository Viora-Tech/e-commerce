'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import OrderChip from '@/components/orders/order-chip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Shipment = Awaited<ReturnType<typeof api.shipments.list>>['items'][number]

type RecentShipmentsCardProps = {
  /** The newest Delhivery shipments (`shipments.list` with `provider`); null while loading. */
  items: Shipment[] | null
}

/** Figma 928:11256 "Recent shipments": AWB, order and where it goes, status, last change. */
export default function RecentShipmentsCard({ items }: RecentShipmentsCardProps) {
  // Hooks
  const { overview: copy } = useCopy(delhiveryAppContent)
  const format = useFormat()

  // Render logic
  const c = copy.recent.columns

  return (
    <section className="overflow-hidden rounded-xl border border-border surface-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-body font-semibold text-ink-strong">{copy.recent.title}</h2>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.apps.page('delhivery', 'shipments')} />}
        >
          {copy.recent.viewAll}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD}>{c.awb}</TableHead>
            <TableHead className={HEAD}>{c.order}</TableHead>
            <TableHead className={HEAD}>{c.status}</TableHead>
            <TableHead className={`${HEAD} text-right`}>{c.updated}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items !== null && items.length === 0 ? (
            <TableEmptyRow colSpan={4} message={copy.recent.empty} />
          ) : null}
          {(items ?? []).map((s) => (
            <TableRow key={s.id}>
              <TableCell className={`${CELL} font-medium tabular-nums`}>
                <Link
                  href={routes.orders.shipment(s.orderId)}
                  className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s.waybill}
                </Link>
              </TableCell>
              <TableCell className={CELL}>
                <span className="flex flex-col">
                  <span className="text-ink-strong tabular-nums">#{s.orderNumber}</span>
                  <span className="text-caption text-muted-foreground">
                    {[s.city, s.pincode].filter(Boolean).join(' ')}
                  </span>
                </span>
              </TableCell>
              <TableCell className={CELL}>
                <OrderChip kind="shipment" value={s.status} />
              </TableCell>
              <TableCell className={`${CELL} text-right text-muted-foreground`}>
                {format.ago(s.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
