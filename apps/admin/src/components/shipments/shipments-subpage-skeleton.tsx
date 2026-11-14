'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import SimpleTable from '@/components/table/simple-table'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'
import { shipmentsContent } from '@/data/shipments'
import { statesContent } from '@/data/states'
import { useCopy } from '@/hooks/use-copy'

type ShipmentsSubpageSkeletonProps = {
  /** Which queue loads: the same `kind` as ShipmentsSubpage. */
  kind: 'pickups' | 'attention'
}

/* The schedule form's three fields: date, from, to. */
const FIELDS = ['date', 'from', 'to'] as const

/**
 * Shipments › Needs attention or Pickups while the route loads: the real title and back link on
 * the same page shell, then the loaded page's own cards and table headers over placeholder rows,
 * so the cards stay put when the queue arrives (audit section 7 row 6). Before, these pages
 * borrowed the Shipments list skeleton (toolbar, tabs and a big table they do not have).
 */
export default function ShipmentsSubpageSkeleton({ kind }: ShipmentsSubpageSkeletonProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const states = useCopy(statesContent)

  // Render logic
  const head = kind === 'attention' ? copy.ndrSheet : copy.pickupsSheet
  const ndr = copy.ndr
  const pickups = copy.pickups

  return (
    <PageBody>
      <PageHeaderSkeleton title={head.title} back actions={0} />
      {kind === 'attention' ? (
        <DataCard title={ndr.heading} flush>
          <p className="px-4 pt-4 text-body text-muted-foreground">{ndr.help}</p>
          <SimpleTable
            columns={[
              { key: 'order', label: ndr.columns.order },
              { key: 'waybill', label: ndr.columns.waybill },
              { key: 'reason', label: ndr.columns.reason },
              { key: 'raised', label: ndr.columns.raised },
              { key: 'actions', label: ndr.columns.actions, align: 'end' },
            ]}
          >
            <TableSkeletonRows columns={5} rows={3} label={states.loading} />
          </SimpleTable>
        </DataCard>
      ) : (
        <div className="flex flex-col gap-4">
          <DataCard title={pickups.heading}>
            <div
              className="flex flex-col gap-4"
              role="status"
              aria-busy="true"
              aria-label={states.loading}
            >
              <p className="text-body text-muted-foreground">{pickups.help}</p>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {FIELDS.map((f) => (
                  <div key={f} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-9 w-36 self-end" />
            </div>
          </DataCard>
          <DataCard title={pickups.listHeading} flush>
            <SimpleTable
              columns={[
                { key: 'date', label: pickups.columns.date },
                { key: 'window', label: pickups.columns.window },
                { key: 'packages', label: pickups.columns.packages },
                { key: 'status', label: pickups.columns.status },
                { key: 'reference', label: pickups.columns.reference },
                { key: 'actions', label: null },
              ]}
            >
              <TableSkeletonRows columns={6} rows={3} label={states.loading} />
            </SimpleTable>
          </DataCard>
          <DataCard title={pickups.manifestsHeading} flush>
            <p className="px-4 pt-4 text-caption text-muted-foreground">{pickups.manifestHelp}</p>
            <SimpleTable
              columns={[
                { key: 'courier', label: pickups.manifestColumns.courier },
                { key: 'shipments', label: pickups.manifestColumns.shipments },
              ]}
            >
              <TableSkeletonRows columns={2} rows={2} label={states.loading} />
            </SimpleTable>
          </DataCard>
        </div>
      )}
    </PageBody>
  )
}
