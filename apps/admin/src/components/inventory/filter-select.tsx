'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { inventoryContent } from '@/data/inventory'

type FilterSelectProps = {
  id: string
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (next: string | null) => void
}

/** `__any` stands for no filter because Select needs a value. */
const ANY = '__any'

/** One labelled facet select inside a list filter popover. */
export default function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  // Render logic
  const items = Object.fromEntries([
    [ANY, inventoryContent.filters.any],
    ...options.map((o) => [o.value, o.label]),
  ])

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? null : String(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{inventoryContent.filters.any}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
