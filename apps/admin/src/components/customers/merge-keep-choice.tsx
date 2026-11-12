'use client'

import { FieldLegend, FieldSet } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { customerMergeContent } from '@/data/customer-merge'
import { useCopy } from '@/hooks/use-copy'

export type MergeChoice = 'kept' | 'merged'

type MergeKeepChoiceProps = {
  /** Field id prefix. */
  id: string
  legend: string
  /** This customer's value and the other record's; null when they have none. */
  kept: string | null
  merged: string | null
  value: MergeChoice
  onChange: (value: MergeChoice) => void
}

/** One "keep this or that" row of the merge dialog (email, phone or name). */
export default function MergeKeepChoice({
  id,
  legend,
  kept,
  merged,
  value,
  onChange,
}: MergeKeepChoiceProps) {
  // Hooks
  const copy = useCopy(customerMergeContent)

  // Render logic
  const options = [
    { key: 'kept' as const, who: copy.thisOne, text: kept },
    { key: 'merged' as const, who: copy.otherOne, text: merged },
  ]

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v === 'merged' ? 'merged' : 'kept')}
        className="grid gap-2 sm:grid-cols-2"
      >
        {options.map((o) => (
          <label
            key={o.key}
            htmlFor={`${id}-${o.key}`}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 has-[[data-checked]]:border-primary"
          >
            <RadioGroupItem
              id={`${id}-${o.key}`}
              value={o.key}
              disabled={!o.text}
              className="mt-0.5"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-caption text-muted-foreground">{o.who}</span>
              <span className="truncate text-body">{o.text || copy.none}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </FieldSet>
  )
}
