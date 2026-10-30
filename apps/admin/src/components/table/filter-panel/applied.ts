import { formatMoney, parseRupees } from '@commerce/money'
import type { AppliedFilter } from '@/components/table/resource-table/toolbar'
import type { filterPanelContent } from '@/data/filter-panel'
import {
  DATE_CUSTOM,
  type DateGroup,
  type FilterGroup,
  type FilterOption,
  type RangeGroup,
  type RangePatch,
} from './types'

const NO_DATE = { preset: null, from: '', to: '' }

/** A date chip: the preset's name, or the custom range ("1 Oct–28 Oct" as typed, yyyy-mm-dd). */
function dateLabel(group: DateGroup, copy: PanelCopy): string | null {
  const { preset, from, to } = group.value
  if (preset && preset !== DATE_CUSTOM) return optionLabel(group.presets, preset)
  if (from && to) return copy.range.between(from, to)
  if (from) return copy.range.atLeast(from)
  if (to) return copy.range.atMost(to)
  return null
}

/** The first two values, then "+3". */
function listLabel(labels: string[], copy: PanelCopy): string {
  const head = labels.slice(0, 2).join(', ')
  return labels.length > 2 ? `${head} ${copy.more(labels.length - 2)}` : head
}

type PanelCopy = typeof filterPanelContent

function optionLabel(options: readonly FilterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}

function bound(group: RangeGroup, value: string): string {
  if (group.format) return group.format(value)
  return group.input === 'money' ? formatMoney(parseRupees(value) ?? 0) : value
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
export function chipFor(group: FilterGroup, copy: PanelCopy): AppliedFilter | null {
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
  if (group.type === 'text') {
    const text = group.value.trim()
    if (!text) return null
    return { key: group.key, field: group.label, label: text, onRemove: () => group.onChange('') }
  }
  if (group.type === 'multi') {
    if (group.value.length === 0) return null
    return {
      key: group.key,
      field: group.label,
      label: listLabel(
        group.value.map((v) => optionLabel(group.options, v)),
        copy,
      ),
      onRemove: () => group.onChange([]),
    }
  }
  if (group.type === 'date') {
    const label = dateLabel(group, copy)
    if (label === null) return null
    return { key: group.key, field: group.label, label, onRemove: () => group.onChange(NO_DATE) }
  }
  if (group.type === 'boolean') {
    if (group.value === null) return null
    return {
      key: group.key,
      field: group.label,
      label: group.value ? (group.yesLabel ?? copy.yes) : (group.noLabel ?? copy.no),
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

/** The group holds a filter, so it shows as a chip. */
export function hasFilter(group: FilterGroup): boolean {
  if (group.type === 'checks' || group.type === 'multi') return group.value.length > 0
  if (group.type === 'select' || group.type === 'boolean') return group.value !== null
  if (group.type === 'text') return group.value.trim() !== ''
  if (group.type === 'date') {
    const { preset, from, to } = group.value
    return (preset !== null && preset !== DATE_CUSTOM) || from !== '' || to !== ''
  }
  return group.from !== '' || (group.to ?? '') !== ''
}

/**
 * The chips the toolbar draws, in the list's own order: every group holding a filter, plus
 * `picked` (just chosen from the Filter menu, its popover open) while it is still empty.
 */
export function chipGroups(groups: FilterGroup[], picked: string | null): FilterGroup[] {
  return groups.filter((g) => g.key === picked || hasFilter(g))
}

/** Empties one group (a chip's ×, or Clear in its popover). */
export function clearGroup(group: FilterGroup): void {
  if (group.type === 'checks' || group.type === 'multi') group.onChange([])
  else if (group.type === 'select' || group.type === 'boolean') group.onChange(null)
  else if (group.type === 'text') group.onChange('')
  else if (group.type === 'date') group.onChange(NO_DATE)
  else group.onChange(emptyRange(group))
}

/** Resets every group (Clear all). */
export function clearGroups(groups: FilterGroup[]): void {
  for (const g of groups) clearGroup(g)
}
