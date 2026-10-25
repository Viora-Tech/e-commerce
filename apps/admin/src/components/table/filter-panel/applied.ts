import type { AppliedFilter } from '@/components/table/resource-table/toolbar'
import type { filterPanelContent } from '@/data/filter-panel'
import type { FilterGroup, FilterOption, RangeGroup, RangePatch } from './types'

type PanelCopy = typeof filterPanelContent

function optionLabel(options: readonly FilterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}

function bound(group: RangeGroup, value: string): string {
  if (group.format) return group.format(value)
  return group.input === 'money' ? `₹${value}` : value
}

function rangeLabel(group: RangeGroup, copy: PanelCopy): string | null {
  const to = group.to ?? ''
  if (group.from && to) return copy.range.between(bound(group, group.from), bound(group, to))
  if (group.from) return copy.range.atLeast(bound(group, group.from))
  if (to) return copy.range.atMost(bound(group, to))
  return null
}

/** Empties both ends of a range (only the ends it has). */
function emptyRange(group: RangeGroup): RangePatch {
  return group.to === undefined ? { from: '' } : { from: '', to: '' }
}

/** The chip for one group, or null while the group holds no filter. */
function chipFor(group: FilterGroup, copy: PanelCopy): AppliedFilter | null {
  if (group.type === 'checks') {
    if (group.value.length === 0) return null
    return {
      key: group.key,
      field: group.label,
      label: group.value.map((v) => optionLabel(group.options, v)).join(', '),
      onRemove: () => group.onChange([]),
    }
  }
  if (group.type === 'select') {
    if (group.value === null) return null
    return {
      key: group.key,
      field: group.label,
      label: optionLabel(group.options, group.value),
      onRemove: () => group.onChange(null),
    }
  }
  const label = rangeLabel(group, copy)
  if (label === null) return null
  return {
    key: group.key,
    field: group.label,
    label,
    onRemove: () => group.onChange(emptyRange(group)),
  }
}

/** One chip per group that holds a filter, so the chips and the panel come from one config. */
export function appliedFromGroups(groups: FilterGroup[], copy: PanelCopy): AppliedFilter[] {
  return groups.flatMap((g) => chipFor(g, copy) ?? [])
}

/** Resets every group (the panel's Clear all). */
export function clearGroups(groups: FilterGroup[]): void {
  for (const g of groups) {
    if (g.type === 'checks') g.onChange([])
    else if (g.type === 'select') g.onChange(null)
    else g.onChange(emptyRange(g))
  }
}
