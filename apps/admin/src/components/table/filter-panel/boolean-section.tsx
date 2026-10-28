'use client'

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import type { BooleanGroup } from './types'

type BooleanSectionProps = { group: BooleanGroup }

const ANY = 'any'

/** Any, Yes or No as one segmented control (GST number given, has photos, subscribed). */
export default function BooleanSection({ group }: BooleanSectionProps) {
  // Hooks
  const copy = useCopy(filterPanelContent)

  // Event handlers
  const handleChange = (next: string[]) => {
    const picked = next.find((v) => v !== current) ?? next[0]
    if (!picked) return
    group.onChange(picked === ANY ? null : picked === 'yes')
  }

  // Render logic
  const current = group.value === null ? ANY : group.value ? 'yes' : 'no'

  return (
    <ToggleGroup
      value={[current]}
      onValueChange={handleChange}
      variant="outline"
      spacing={0}
      aria-label={group.label}
      className="w-full"
    >
      <ToggleGroupItem value={ANY} className="flex-1">
        {copy.any}
      </ToggleGroupItem>
      <ToggleGroupItem value="yes" className="flex-1">
        {group.yesLabel ?? copy.yes}
      </ToggleGroupItem>
      <ToggleGroupItem value="no" className="flex-1">
        {group.noLabel ?? copy.no}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
