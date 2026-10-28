'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import BooleanSection from './boolean-section'
import ChecksSection from './checks-section'
import DateSection from './date-section'
import MultiSection from './multi-section'
import RangeSection from './range-section'
import SelectSection from './select-section'
import TextSection from './text-section'
import type { FilterGroup } from './types'

type FilterPanelProps = {
  /** The panel title (default: "Filters"). */
  heading?: string
  onClear: () => void
  groups: FilterGroup[]
  /** The bottom button, e.g. "Show 12 orders"; `onDone` usually closes the popover. */
  footer?: { label: string; onDone: () => void }
}

type SectionProps = { group: FilterGroup }

/** The popover size every list passes as `filtersClassName`. */
export const FILTER_PANEL_CLASS = 'w-72 p-0'

function GroupControl({ group }: SectionProps) {
  if (group.type === 'checks') return <ChecksSection group={group} />
  if (group.type === 'select') return <SelectSection group={group} />
  if (group.type === 'text') return <TextSection group={group} />
  if (group.type === 'multi') return <MultiSection group={group} />
  if (group.type === 'date') return <DateSection group={group} />
  if (group.type === 'boolean') return <BooleanSection group={group} />
  return <RangeSection group={group} />
}

/* Figma "Orders · Filter": a 12px muted group title over its controls, groups split by a hairline. */
function Section({ group }: SectionProps) {
  return (
    <div className="flex flex-col gap-1.5 border-border border-t px-3.5 py-3 first:border-t-0">
      <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
      <GroupControl group={group} />
    </div>
  )
}

/**
 * The one filter panel for every list (Figma "Orders · Filter"): a header with Clear all,
 * hairline-divided groups, an optional footer button. Each change applies at once.
 */
export default function FilterPanel({ heading, onClear, groups, footer }: FilterPanelProps) {
  // Hooks
  const copy = useCopy(filterPanelContent)

  return (
    <div className="flex max-h-[min(36rem,var(--available-height))] flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-border border-b px-3.5">
        <p className="text-body font-medium text-ink-strong">{heading ?? copy.heading}</p>
        <Button variant="ghost" size="sm" className="-mr-2" onClick={onClear}>
          {copy.clearAll}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((g) => (
          <Section key={g.key} group={g} />
        ))}
      </div>
      {footer ? (
        <div className="shrink-0 border-border border-t p-3">
          <Button className="w-full" onClick={footer.onDone}>
            {footer.label}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
