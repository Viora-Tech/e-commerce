'use client'

import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { api } from '@/lib/api-client'
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
        <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
      </DataCard>
    )
  }

  // Render logic
  const body = !parcels ? (
    <p className="flex items-center gap-2 text-body text-muted-foreground">
      <Spinner />
    </p>
  ) : parcels.length === 0 ? (
    <p className="text-body text-muted-foreground">{copy.empty}</p>
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
