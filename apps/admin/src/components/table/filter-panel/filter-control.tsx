'use client'

import type { ReactNode } from 'react'
import BooleanSection from './boolean-section'
import ChecksSection from './checks-section'
import DateSection from './date-section'
import MultiSection from './multi-section'
import RangeSection from './range-section'
import SelectSection from './select-section'
import TextSection from './text-section'
import type { FilterGroup } from './types'

type FilterControlProps = { group: FilterGroup }

function controlFor(group: FilterGroup): ReactNode {
  if (group.type === 'checks') return <ChecksSection group={group} />
  if (group.type === 'select') return <SelectSection group={group} />
  if (group.type === 'text') return <TextSection group={group} />
  if (group.type === 'multi') return <MultiSection group={group} />
  if (group.type === 'date') return <DateSection group={group} />
  if (group.type === 'boolean') return <BooleanSection group={group} />
  return <RangeSection group={group} />
}

/** One filter's controls (tick boxes, a range, dates…), as its chip's popover shows them. */
export default function FilterControl({ group }: FilterControlProps) {
  return controlFor(group)
}
