'use client'

import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { indiaPostAppContent } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ParcelRow, { type Parcel } from './parcel-row'

/** Statuses still moving; a delivered, returned or cancelled parcel leaves the list. */
const OPEN = ['created', 'picked_up', 'in_transit', 'out_for_delivery']

/** India Post parcels on the way, newest first, each with its status control. */
export default function ParcelsCard() {
  // Hooks
  const copy = useCopy(indiaPostAppContent)
  const [parcels, setParcels] = useState<Parcel[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload on each saved status
  useEffect(() => {
    let live = true
    api.shipments
      .list({ provider: 'india-post', status: OPEN, perPage: 50 })
      .then((r) => live && setParcels(r.items))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [revision])

  // Early returns
  if (failed) {
    return (
      <DataCard title={copy.parcels.heading}>
        <p className="text-body text-muted-foreground">{copy.parcels.loadFailed}</p>
      </DataCard>
    )
  }

  // Render logic
  const body = !parcels ? (
    <p className="flex items-center gap-2 text-body text-muted-foreground">
      <Spinner />
    </p>
  ) : parcels.length === 0 ? (
    <p className="text-body text-muted-foreground">{copy.parcels.empty}</p>
  ) : (
    <ul className="flex flex-col divide-y divide-hairline">
      {parcels.map((p) => (
        <ParcelRow key={p.id} parcel={p} onSaved={() => setRevision((n) => n + 1)} />
      ))}
    </ul>
  )

  return (
    <DataCard title={copy.parcels.heading} subtitle={copy.parcels.help} count={parcels?.length}>
      {body}
    </DataCard>
  )
}
