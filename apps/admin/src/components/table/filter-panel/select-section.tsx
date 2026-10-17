'use client'

import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import type { SelectGroup } from './types'

type SelectSectionProps = { group: SelectGroup }

export default function SelectSection({ group }: SelectSectionProps) {
  // Event handlers
  const handleChange = (next: string) => {
    group.onChange(group.options.some((o) => o.value === next) ? next : null)
  }

  return (
    <NativeSelect
      className="w-full"
      aria-label={group.label}
      value={group.value ?? ''}
      onChange={(e) => handleChange(e.target.value)}
    >
      <NativeSelectOption value="">{group.anyLabel}</NativeSelectOption>
      {group.options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
