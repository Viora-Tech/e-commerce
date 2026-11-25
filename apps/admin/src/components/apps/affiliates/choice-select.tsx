'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type ChoiceSelectProps<V extends string> = {
  id?: string | undefined
  value: V
  options: readonly { value: V; label: string }[]
  onChange: (value: V) => void
  'aria-label'?: string | undefined
  className?: string | undefined
}

/* The select keeps `null` for "nothing chosen", so an option whose value is '' (All programs,
   the default program) travels under this stand-in. */
const EMPTY = '__empty__'

const toItem = (v: string) => (v === '' ? EMPTY : v)

/** The Affiliates screens' select: our shadcn Select over a short fixed list of options. */
export default function ChoiceSelect<V extends string>({
  id,
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: ChoiceSelectProps<V>) {
  // Event handlers
  const handleChange = (next: unknown) => {
    if (typeof next !== 'string') return
    const picked = options.find((o) => toItem(o.value) === next)
    if (picked) onChange(picked.value)
  }

  // Render logic
  const items = Object.fromEntries(options.map((o) => [toItem(o.value), o.label]))

  return (
    <Select items={items} value={toItem(value)} onValueChange={handleChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={toItem(o.value)} value={toItem(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
