'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import AddressLines from '@/components/layout/address-lines'
import StatusChip from '@/components/layout/status-chip'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import ChangePickupDialog from './change-pickup-dialog'
import type { DraftOrder, ShipmentDraft } from './flow-state'

type PickupPlace = ShipmentDraft['pickupPlaces'][number]

type RouteCardProps = {
  from: PickupPlace | undefined
  places: ShipmentDraft['pickupPlaces']
  order: DraftOrder
  /** True once at least one courier can take the parcel to this PIN code. */
  serviceable: boolean
  onPickupChange: (locationId: string | null) => void
  /** Opens the order's address dialog in place, so the merchant stays on this page. */
  onEditCustomer: () => void
}

type Place = {
  name: string | null
  line1: string | null
  line2: string | null
  city: string | null
  stateCode: string | null
  pincode: string | null
  phone: string | null
}

type SideProps = {
  label: string
  place: Place | null
  chip: ReactNode
  actions: ReactNode
}

function Address({ place }: { place: Place }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body font-medium text-ink-strong">{place.name}</p>
      <AddressLines
        className="text-muted-foreground"
        address={{
          line1: place.line1 ?? '',
          line2: place.line2,
          city: place.city ?? '',
          stateCode: place.stateCode ?? '',
          pincode: place.pincode ?? '',
          phone: place.phone,
        }}
      />
    </div>
  )
}

function Side({ label, place, chip, actions }: SideProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex min-h-5.5 items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full border border-current" />
          {label}
        </p>
        {chip}
      </div>
      {place ? <Address place={place} /> : <p className="text-muted-foreground">—</p>}
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  )
}

/** The "Gurugram 122001" under a city on the route bar. */
function Endpoint({ place, align }: { place: Place | null; align: 'start' | 'end' }) {
  return (
    <div className={align === 'end' ? 'text-right' : 'text-left'}>
      <p className="text-body font-medium text-ink-strong">{place?.city ?? '—'}</p>
      <p className="text-caption text-muted-foreground">{place?.pincode}</p>
    </div>
  )
}

/** Figma Create shipment, top card: where the parcel leaves from and where it goes. The route
 *  bar has no distance or zone chip: the quote does not return either. */
export default function RouteCard({
  from,
  places,
  order,
  serviceable,
  onPickupChange,
  onEditCustomer,
}: RouteCardProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.page)
  const [changing, setChanging] = useState(false)

  // Render logic
  const to: Place = { ...order, name: order.customerName }
  const origin: Place | null = from ? { ...from } : null
  const isDefault = from !== undefined && from.id === null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Endpoint place={origin} align="start" />
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border" />
        <Endpoint place={to} align="end" />
      </div>
      <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border">
        <Side
          label={copy.shipFrom}
          place={origin}
          chip={isDefault ? <StatusChip variant="outline">{copy.defaultPickup}</StatusChip> : null}
          actions={
            <>
              {isDefault ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={routes.settings.shipping()} />}
                >
                  <Pencil aria-hidden="true" />
                  {copy.edit}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
                {copy.change}
              </Button>
            </>
          }
        />
        <Side
          label={copy.shipTo}
          place={to}
          chip={serviceable ? <StatusChip tone="success">{copy.pinServiceable}</StatusChip> : null}
          actions={
            <Button variant="outline" size="sm" onClick={onEditCustomer}>
              <Pencil aria-hidden="true" />
              {copy.edit}
            </Button>
          }
        />
      </div>
      <ChangePickupDialog
        open={changing}
        onOpenChange={setChanging}
        places={places}
        value={from?.id ?? null}
        onChange={onPickupChange}
      />
    </section>
  )
}
