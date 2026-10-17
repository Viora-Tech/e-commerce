'use client'

import AddressLines from '@/components/layout/address-lines'
import DataCard from '@/components/layout/data-card'
import LabeledGroup from '@/components/layout/labeled-group'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import type { DraftOrder, ShipmentDraft } from './flow-state'

type PickupPlace = ShipmentDraft['pickupPlaces'][number]

type RouteCardProps = {
  from: PickupPlace | undefined
  order: DraftOrder
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

/** "Gurugram 122001" for the route line. */
function cityLine(p: Place): string {
  return [p.city, p.pincode].filter(Boolean).join(' ')
}

function Address({ place }: { place: Place }) {
  return (
    <div className="flex flex-col gap-1">
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

/** Figma Create shipment, top card: where the parcel leaves from and where it goes. */
export default function RouteCard({ from, order }: RouteCardProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.page)

  // Render logic
  const to: Place = { ...order, name: order.customerName }
  const origin: Place | null = from ? { ...from } : null

  return (
    <DataCard title={copy.route}>
      <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-body">
        <span className="font-medium text-ink-strong">{origin ? cityLine(origin) : '—'}</span>
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border" />
        <span className="font-medium text-ink-strong">{cityLine(to)}</span>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <LabeledGroup label={copy.shipFrom}>
          {origin ? <Address place={origin} /> : <p className="text-muted-foreground">—</p>}
        </LabeledGroup>
        <LabeledGroup label={copy.shipTo}>
          <Address place={to} />
        </LabeledGroup>
      </div>
    </DataCard>
  )
}
