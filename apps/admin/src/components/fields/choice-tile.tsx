'use client'

import { cn } from '@commerce/ui/lib/utils'
import { FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroupItem } from '@commerce/ui/shadcn/radio-group'

type ChoiceTileProps = {
  /** Prefix for the radio id, unique on the page. */
  name: string
  value: string
  checked: boolean
  label: string
  help?: string | undefined
}

/**
 * A radio option drawn as a bordered tile that fills soft green when picked (Shopify's method
 * cards). Put several inside a `RadioGroup` laid out as a grid: each tile fills its cell, so a
 * row of tiles is evenly sized whatever their text.
 */
export default function ChoiceTile({ name, value, checked, label, help }: ChoiceTileProps) {
  // Render logic
  const id = `${name}-${value}`

  return (
    // FieldLabel is `w-fit` and tints itself when its radio is checked; the tile sizes to its
    // grid cell and owns the checked look instead.
    <FieldLabel
      htmlFor={id}
      className={cn(
        'h-full w-full cursor-pointer items-start gap-3 rounded-lg border border-border p-4 font-normal transition-[background-color,border-color] hover:bg-muted',
        'has-data-checked:border-primary has-data-checked:bg-primary-soft dark:has-data-checked:border-primary dark:has-data-checked:bg-primary-soft',
        checked && 'hover:bg-primary-soft',
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-strong">{label}</span>
        {help ? <span className="text-caption">{help}</span> : null}
      </span>
    </FieldLabel>
  )
}
