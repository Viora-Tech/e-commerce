'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { COUNTRIES } from '@/data/countries'

type CountrySelectProps = {
  id: string
  /** ISO 3166-1 alpha-2 code ("IN"). A code missing from the list still shows as itself. */
  value: string
  onChange: (code: string) => void
  disabled?: boolean | undefined
  className?: string | undefined
}

/** A country picked by name, saved as its two-letter code (supplier country, audit #158). */
export default function CountrySelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: CountrySelectProps) {
  // Render logic
  const known = COUNTRIES.some((c) => c.code === value)
  const options = known || !value ? COUNTRIES : [...COUNTRIES, { code: value, name: value }]
  const items = Object.fromEntries(options.map((c) => [c.code, c.name]))

  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(String(next))}
    >
      <SelectTrigger id={id} className={className ?? 'w-full'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
