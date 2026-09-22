'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { customizeContent } from '@/data/customize'
import type { ResourceKind, ResourceOption } from '@/lib/customize-resource'

type ResourcePickerProps = {
  kind: ResourceKind
  value: string | null
  options: ResourceOption[]
  onChange: (id: string) => void
}

const copy = customizeContent.resource

/** Which product, collection or page the preview draws the template with. */
export default function ResourcePicker({ kind, value, options, onChange }: ResourcePickerProps) {
  // Event handlers
  const handleChange = (next: unknown) => {
    if (typeof next === 'string') onChange(next)
  }

  // Render logic
  const items = options.map((o) => ({ value: o.id, label: o.title }))
  return (
    <Select items={items} value={value} onValueChange={handleChange} disabled={items.length === 0}>
      <SelectTrigger className="w-56" aria-label={copy.label}>
        <SelectValue placeholder={items.length === 0 ? copy.empty : copy[kind]} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
