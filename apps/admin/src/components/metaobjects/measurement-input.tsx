'use client'

import { type FieldValidations, MEASURE_UNITS, type MeasureUnit } from '@commerce/core/metaobjects'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import { fieldInputContent, measureContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type MeasurementInputProps = {
  id: string
  value: unknown
  rules?: FieldValidations | undefined
  invalid?: boolean | undefined
  onChange: (value: unknown) => void
}

type Parts = { value?: unknown; unit?: unknown }

const partsOf = (value: unknown): Parts =>
  typeof value === 'object' && value !== null ? (value as Parts) : {}

/** A number and its unit side by side: `1.5` `kg`. The unit list follows the field's kind. */
export default function MeasurementInput({
  id,
  value,
  rules,
  invalid,
  onChange,
}: MeasurementInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)
  const { units: unitNames } = useCopy(measureContent)
  const [unitChoice, setUnitChoice] = useState<MeasureUnit | null>(null)

  // Helpers
  const emit = (text: string, unit: MeasureUnit) =>
    onChange(text.trim() === '' ? null : { value: text, unit })

  // Render logic
  const units: readonly MeasureUnit[] = rules?.measure ? MEASURE_UNITS[rules.measure] : []
  const parts = partsOf(value)
  const savedUnit = units.find((u) => u === parts.unit)
  const unit = savedUnit ?? unitChoice ?? units[0] ?? null
  const number =
    typeof parts.value === 'number' || typeof parts.value === 'string' ? parts.value : ''

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_8rem] gap-2 sm:max-w-80">
      <Input
        id={id}
        size="lg"
        type="text"
        inputMode="decimal"
        aria-label={copy.number}
        aria-invalid={invalid || undefined}
        value={String(number)}
        onChange={(e) => unit && emit(e.target.value, unit)}
      />
      <Select
        items={Object.fromEntries(units.map((u) => [u, unitNames[u]]))}
        value={unit}
        onValueChange={(next) => {
          if (!next) return
          setUnitChoice(next as MeasureUnit)
          if (number !== '') emit(String(number), next as MeasureUnit)
        }}
      >
        <SelectTrigger size="lg" className="w-full" aria-label={copy.unit}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u} value={u}>
              {unitNames[u]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
