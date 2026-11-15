'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { api } from '@/lib/api-client'
import LoadFailedState from './load-failed-state'
import ManualParcelRow, { type ManualParcelsCopy, type Parcel } from './manual-parcel-row'

type ManualParcelsCardProps = {
  /** The courier app whose parcels are listed. */
  providerId: string
  copy: ManualParcelsCopy
  trackingPage: string
}

/** Statuses still moving; a delivered, returned or cancelled parcel leaves the list. */
const OPEN = ['created', 'picked_up', 'in_transit', 'out_for_delivery']

/** The parcels on the way with a courier that sends no tracking (India Post, ShipGlobal),
 *  newest first, each with its status control. */
export default function ManualParcelsCard({
  providerId,
  copy,
  trackingPage,
}: ManualParcelsCardProps) {
  // Hooks
  const [parcels, setParcels] = useState<Parcel[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload on each saved status
  useEffect(() => {
    let live = true
    setFailed(false)
    api.shipments
      .list({ provider: providerId, status: OPEN, perPage: 50 })
      .then((r) => live && setParcels(r.items))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [revision, providerId])

  // Early returns
  if (failed) {
    return (
      <DataCard title={copy.heading}>
        <LoadFailedState heading={copy.loadFailed} onRetry={() => setRevision((n) => n + 1)} />
      </DataCard>
    )
  }

  // Render logic
  const body = !parcels ? (
    // Two parcel rows (name and status line, status control) while they load.
    <ul className="flex flex-col divide-y divide-hairline" aria-busy="true">
      {[0, 1].map((i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-3">
          <span className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </span>
          <Skeleton className="h-9 w-36 rounded-sm" />
        </li>
      ))}
    </ul>
  ) : parcels.length === 0 ? (
    <EmptyState variant="inline" body={copy.empty} />
  ) : (
    <ul className="flex flex-col divide-y divide-hairline">
      {parcels.map((p) => (
        <ManualParcelRow
          key={p.id}
          parcel={p}
          copy={copy}
          trackingPage={trackingPage}
          onSaved={() => setRevision((n) => n + 1)}
        />
      ))}
    </ul>
  )

  return (
    <DataCard title={copy.heading} subtitle={copy.help} count={parcels?.length}>
      {body}
    </DataCard>
  )
}
