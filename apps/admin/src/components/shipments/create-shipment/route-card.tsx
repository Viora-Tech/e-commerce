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
  /** Shown instead of an address the side does not have. */
  empty: ReactNode
}

/** A pickup place with no street or city yet: only the PIN code is known (#17). */
function hasAddress(place: Place | null): place is Place {
  return Boolean(place?.city?.trim() || place?.line1?.trim())
}

/** Where a missing pickup address is added: the shipping settings' ship-from address. */
function AddPickupLink() {
  // Hooks
  const copy = useCopy(createShipmentContent.page)

  return (
    <Link
      href={routes.settings.shipping()}
      className="text-body font-medium text-primary hover:underline"
    >
      {copy.addPickupAddress}
    </Link>
  )
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

function Side({ label, place, chip, actions, empty }: SideProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex min-h-5.5 items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full border border-current" />
          {label}
        </p>
        {chip}
      </div>
      {place ? <Address place={place} /> : empty}
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  )
}

/** The "Gurugram 122001" under a city on the route bar; a pickup with only a PIN shows its name
 * and PIN (couriers still collect from their own saved address), with nothing at all a link. */
function Endpoint({
  place,
  align,
  pinOnly,
}: {
  place: Place | null
  align: 'start' | 'end'
  pinOnly?: { name: string | null; pincode: string } | null
}) {
  // Render logic
  const isOrigin = align === 'start'

  return (
    <div className={align === 'end' ? 'text-right' : 'text-left'}>
      {hasAddress(place) ? (
        <>
          <p className="text-body font-medium text-ink-strong">{place.city ?? '—'}</p>
          <p className="text-caption text-muted-foreground">{place.pincode}</p>
        </>
      ) : isOrigin && pinOnly ? (
        <>
          <p className="text-body font-medium text-ink-strong">{pinOnly.name ?? '—'}</p>
          <p className="text-caption text-muted-foreground">{pinOnly.pincode}</p>
        </>
      ) : isOrigin ? (
        <AddPickupLink />
      ) : (
        <p className="text-body font-medium text-ink-strong">—</p>
      )}
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
  // A pickup place with only a PIN code reads as missing: "— 110001" told the merchant nothing.
  const origin: Place | null = from && hasAddress(from) ? { ...from } : null
  const isDefault = from !== undefined && from.id === null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Endpoint
          place={origin}
          align="start"
          pinOnly={from?.pincode ? { name: from.name, pincode: from.pincode } : null}
        />
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border" />
        <Endpoint place={to} align="end" />
      </div>
      <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border">
        <Side
          label={copy.shipFrom}
          place={origin}
          empty={
            <div className="flex flex-col gap-2">
              {from?.name ? (
                <p className="text-body font-medium text-ink-strong">{from.name}</p>
              ) : null}
              {from?.pincode ? (
                <p className="text-muted-foreground">{copy.pickupPin(from.pincode)}</p>
              ) : null}
              <p className="text-caption text-muted-foreground">{copy.courierPickupNote}</p>
              <AddPickupLink />
            </div>
          }
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
          empty={<p className="text-muted-foreground">—</p>}
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
