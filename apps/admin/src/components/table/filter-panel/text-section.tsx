'use client'

import { Input } from '@commerce/ui/shadcn/input'
import type { TextGroup } from './types'

type TextSectionProps = { group: TextGroup }

export default function TextSection({ group }: TextSectionProps) {
  return (
    <Input
      type="search"
      aria-label={group.label}
      placeholder={group.placeholder}
      value={group.value}
      onChange={(e) => group.onChange(e.target.value)}
    />
  )
}
