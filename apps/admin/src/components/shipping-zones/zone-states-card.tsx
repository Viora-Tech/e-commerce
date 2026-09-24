'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import DataCard from '@/components/layout/data-card'
import { INDIAN_STATES } from '@/data/india'
import { shippingRatesContent } from '@/data/shipping-rates'

type ZoneStatesCardProps = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

const copy = shippingRatesContent.zone.regions

/** Tick the states this zone covers; none ticked (and no PIN codes) means all of India. */
export default function ZoneStatesCard({ value, onChange, disabled }: ZoneStatesCardProps) {
  // Event handlers
  const handleToggle = (code: string, on: boolean) => {
    onChange(on ? [...value, code] : value.filter((c) => c !== code))
  }

  const handleAll = () => {
    onChange(value.length === INDIAN_STATES.length ? [] : INDIAN_STATES.map((s) => s.code))
  }

  // Render logic
  const all = value.length === INDIAN_STATES.length

  return (
    <DataCard
      title={copy.heading}
      meta={value.length ? copy.selected(value.length) : copy.meta}
      action={
        <Button variant="outline" size="sm" onClick={handleAll} disabled={disabled}>
          {all ? copy.clear : copy.selectAll}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {INDIAN_STATES.map((s) => (
          <Label key={s.code} className="flex items-center gap-2 text-body font-normal">
            <Checkbox
              checked={value.includes(s.code)}
              disabled={disabled}
              onCheckedChange={(v) => handleToggle(s.code, Boolean(v))}
            />
            {s.name}
          </Label>
        ))}
      </div>
    </DataCard>
  )
}
