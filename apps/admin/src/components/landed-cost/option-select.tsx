'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type OptionSelectProps<T extends string> = {
  id: string
  /** The choices in order, each with its label. */
  options: readonly T[]
  labels: Record<T, string>
  value: T
  onChange: (value: T) => void
}

/** A full-width select over a fixed list of values (charge kinds, split methods, statuses). */
export default function OptionSelect<T extends string>({
  id,
  options,
  labels,
  value,
  onChange,
}: OptionSelectProps<T>) {
  // Render logic
  return (
    <Select items={labels} value={value} onValueChange={(v) => onChange(String(v) as T)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels[o]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
