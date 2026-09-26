'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'

type Choice = { value: string; label: string; hint?: string | undefined }

type ChoiceListProps = {
  name: string
  choices: Choice[]
  value: string
  onChange: (value: string) => void
}

/** Big, plain radio rows with a one-line hint each: one question, a few answers. */
export default function ChoiceList({ name, choices, value, onChange }: ChoiceListProps) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(String(v))} className="gap-3">
      {choices.map((c) => (
        <Field
          key={c.value}
          orientation="horizontal"
          className="items-start rounded-lg border border-border p-3 has-data-checked:border-primary"
        >
          <RadioGroupItem id={`${name}-${c.value}`} value={c.value} className="mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor={`${name}-${c.value}`} className="font-medium">
              {c.label}
            </FieldLabel>
            {c.hint ? <FieldDescription>{c.hint}</FieldDescription> : null}
          </div>
        </Field>
      ))}
    </RadioGroup>
  )
}
