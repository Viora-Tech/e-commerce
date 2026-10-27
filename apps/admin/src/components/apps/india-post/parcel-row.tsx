'use client'

import { INDIA_POST_TRACKING_PAGE } from '@commerce/shipping-indiapost/client'
import { ExternalLink, Printer, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import RelativeTime from '@/components/layout/relative-time'
import { indiaPostAppContent } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type Parcel = {
  id: string
  orderNumber: number
  waybill: string
  status: string
  shipToName: string | null
  city: string | null
  pincode: string | null
  labelUrl: string | null
  updatedAt: Date | string
}

type ParcelRowProps = {
  parcel: Parcel
  onSaved: () => void
}

type ManualStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto'

const STATUSES: readonly ManualStatus[] = [
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'rto',
]

/** One parcel: who it goes to, its article number, label, a link to India Post's tracker and
 *  the status the merchant read there. */
export default function ParcelRow({ parcel, onSaved }: ParcelRowProps) {
  // Hooks
  const copy = useCopy(indiaPostAppContent)
  const [status, setStatus] = useState(parcel.status as ManualStatus)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.shipments.recordStatus({
        shipmentId: parcel.id,
        status,
        description: copy.parcels.statuses[status] ?? status,
      })
      toast.success(copy.parcels.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const to = [parcel.shipToName, parcel.city, parcel.pincode].filter(Boolean).join(', ')
  const changed = status !== parcel.status

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-strong">
          {copy.parcels.order(parcel.orderNumber)}
          <code className="text-caption text-muted-foreground">{parcel.waybill}</code>
          <CopyButton value={parcel.waybill} what={copy.parcels.copyNumber} visible />
        </span>
        <span className="truncate text-caption text-muted-foreground">
          {to} · <RelativeTime value={parcel.updatedAt} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label={copy.parcels.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as ManualStatus)}
        >
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {copy.parcels.statuses[s] ?? s}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button size="sm" onClick={handleSave} disabled={!changed || saving}>
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          {saving ? copy.parcels.saving : copy.parcels.update}
        </Button>
        {parcel.labelUrl ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={parcel.labelUrl} />}
          >
            <Printer aria-hidden="true" />
            {copy.parcels.label}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          title={copy.parcels.trackHelp}
          render={<a href={INDIA_POST_TRACKING_PAGE} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink aria-hidden="true" />
          {copy.parcels.track}
        </Button>
      </div>
    </li>
  )
}
