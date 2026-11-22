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
import TableFailedRow from '@/components/apps/shared/table-failed-row'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import TableEmptyRow from '@/components/table/table-empty-row'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'
import { appsContent } from '@/data/apps'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Shipment = Awaited<ReturnType<typeof api.shipments.list>>['items'][number]

type RecentShipmentsCardProps = {
  /** The newest Delhivery shipments (`shipments.list` with `provider`); null while loading. */
  items: Shipment[] | null
  /** The read failed: "Could not load the shipments" with Try again in the table. */
  failed?: boolean
  onRetry?: () => void
}

/** Figma 928:11256 "Recent shipments": AWB, order and where it goes, status, last change. */
export default function RecentShipmentsCard({
  items,
  failed = false,
  onRetry = () => undefined,
}: RecentShipmentsCardProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const { overview: copy } = useCopy(delhiveryAppContent)
  const format = useFormat()

  // Render logic
  const c = copy.recent.columns

  return (
    <DataCard
      title={copy.recent.title}
      action={
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.orders.courierShipments('delhivery')} />}
        >
          {copy.recent.viewAll}
        </Button>
      }
      flush
    >
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
          {failed ? (
            <TableFailedRow colSpan={4} heading={apps.couldNotLoad.shipments} onRetry={onRetry} />
          ) : items === null ? (
            <TableSkeletonRows
              columns={4}
              rows={4}
              cellClassName={CELL}
              label={copy.recent.title}
            />
          ) : items.length === 0 ? (
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
                <StatusLabel kind="shipment" value={s.status} variant="soft" />
              </TableCell>
              <TableCell className={`${CELL} text-right text-muted-foreground`}>
                {format.ago(s.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
