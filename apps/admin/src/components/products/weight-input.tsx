'use client'

import { WEIGHT_UNITS, type WeightUnit } from '@commerce/core/catalog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import MoneyInput from '@/components/fields/money-input'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { SUSPECT_GRAMS } from '@/lib/weight-check'
import { convertWeight, toGrams } from './weight-units'

type WeightInputProps = {
  id: string
  /** As typed, in `unit`. */
  weight: string
  unit: WeightUnit
  onChange: (patch: { weight: string; weightUnit: WeightUnit }) => void
}

/** A variant's weight with a g / kg / lb / oz picker; switching unit keeps the same weight. */
export default function WeightInput({ id, weight, unit, onChange }: WeightInputProps) {
  // Hooks
  const { shipping: copy } = useCopy(productFormContent)
  const fmt = useFormat()

  // Event handlers
  const handleUnit = (next: WeightUnit) =>
    onChange({ weightUnit: next, weight: convertWeight(weight, unit, next) })

  // Render logic
  const unitItems = Object.fromEntries(WEIGHT_UNITS.map((u) => [u, copy.weightUnits[u]]))
  const grams = toGrams(weight, unit) ?? 0
  const tooHeavy = grams > SUSPECT_GRAMS

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 md:max-w-[20.75rem]">
        <MoneyInput
          size="lg"
          id={id}
          currency={false}
          value={weight}
          onChange={(next) => onChange({ weight: next, weightUnit: unit })}
          className="min-w-0 flex-1"
        />
        <Select
          items={unitItems}
          value={unit}
          onValueChange={(next) => handleUnit(next as WeightUnit)}
        >
          <SelectTrigger size="lg" aria-label={copy.weightUnit} className="w-20 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEIGHT_UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {copy.weightUnits[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {tooHeavy ? (
        <p role="alert" className="text-caption text-destructive">
          {copy.weightTooHeavy(fmt.number(Math.round(grams / 10) / 100))}
        </p>
      ) : null}
    </div>
  )
}
