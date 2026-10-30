'use client'

import { ExternalLink, Printer, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import RelativeTime from '@/components/layout/relative-time'
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

/** The parcels card's words; each app passes its own, already localised. */
export type ManualParcelsCopy = {
  heading: string
  help: string
  empty: string
  loadFailed: string
  order: (n: number) => string
  status: string
  update: string
  saving: string
  saved: string
  track: string
  trackHelp: string
  label: string
  copyNumber: string
  statuses: Record<string, string>
}

type ManualParcelRowProps = {
  parcel: Parcel
  copy: ManualParcelsCopy
  /** The courier's public tracker, opened in a new tab. */
  trackingPage: string
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

/** One parcel of a courier with no tracking feed (India Post, ShipGlobal): who it goes to,
 *  its number, label, a link to the courier's tracker and the status the merchant read there. */
export default function ManualParcelRow({
  parcel,
  copy,
  trackingPage,
  onSaved,
}: ManualParcelRowProps) {
  // Hooks
  const [status, setStatus] = useState(parcel.status as ManualStatus)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.shipments.recordStatus({
        shipmentId: parcel.id,
        status,
        description: copy.statuses[status] ?? status,
      })
      toast.success(copy.saved)
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
          {copy.order(parcel.orderNumber)}
          <code className="text-caption text-muted-foreground">{parcel.waybill}</code>
          <CopyButton value={parcel.waybill} what={copy.copyNumber} visible />
        </span>
        <span className="truncate text-caption text-muted-foreground">
          {to} · <RelativeTime value={parcel.updatedAt} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label={copy.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as ManualStatus)}
        >
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {copy.statuses[s] ?? s}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button size="sm" onClick={handleSave} disabled={!changed || saving}>
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          {saving ? copy.saving : copy.update}
        </Button>
        {parcel.labelUrl ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={parcel.labelUrl} />}
          >
            <Printer aria-hidden="true" />
            {copy.label}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          title={copy.trackHelp}
          render={<a href={trackingPage} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink aria-hidden="true" />
          {copy.track}
        </Button>
      </div>
    </li>
  )
}
