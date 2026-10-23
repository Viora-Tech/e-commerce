'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type SelectInputProps = {
  id?: string | undefined
  value: string | null
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  'aria-label'?: string | undefined
  placeholder?: string | undefined
  className?: string | undefined
}

/** A select over a small fixed list, showing the chosen option's label. */
export default function SelectInput({
  id,
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  placeholder,
  className,
}: SelectInputProps) {
  // Render logic
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))

  return (
    <Select items={items} value={value || null} onValueChange={(v) => v && onChange(String(v))}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
