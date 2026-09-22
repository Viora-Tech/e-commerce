'use client'

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'

type ChoiceFieldProps<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** A small set of exclusive options as a segmented control. */
export default function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
}: ChoiceFieldProps<T>) {
  // Event handlers
  const handleChange = (values: unknown[]) => {
    const next = options.find((o) => o.value === values[0])
    if (next) onChange(next.value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body text-foreground">{label}</span>
      <ToggleGroup
        value={[value]}
        onValueChange={handleChange}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={label}
        className="w-full"
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
