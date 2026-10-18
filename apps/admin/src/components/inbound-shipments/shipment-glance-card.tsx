'use client'

import type { CostPreview } from '@/components/landed-cost/types'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { inboundShipmentFormContent } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'

type ShipmentGlanceCardProps = {
  orders: { units: number }[]
  costs: CostPreview | null
}

/** Figma inbound shipment, side column (651:2763): the shipment's numbers in four lines. */
export default function ShipmentGlanceCard({ orders, costs }: ShipmentGlanceCardProps) {
  // Hooks
  const { glance: copy } = useCopy(inboundShipmentFormContent)
  const fmt = useFormat()

  // Render logic
  const lines = costs?.lines ?? []
  const goods = lines.reduce((n, l) => n + l.goodsPaise, 0)
  const charges = lines.reduce((n, l) => n + l.chargesPaise, 0)

  return (
    <DataCard title={copy.heading}>
      <KeyValueList
        variant="grid"
        rows={[
          { label: copy.orders, value: fmt.number(orders.length) },
          { label: copy.units, value: fmt.number(orders.reduce((n, o) => n + o.units, 0)) },
          { label: copy.charges, value: fmt.money(charges), hidden: !costs },
          { label: copy.landed, value: fmt.money(goods + charges), hidden: !costs, strong: true },
        ]}
      />
    </DataCard>
  )
}
