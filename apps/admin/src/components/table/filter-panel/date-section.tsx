'use client'

import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import DateField from '@/components/fields/date-field'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import { DATE_CUSTOM, type DateGroup } from './types'

type DateSectionProps = { group: DateGroup }

/**
 * A date filter: Any, the group's presets ("Last 7 days"), or a custom range whose From and To
 * fields show when picked. Either end may stay empty ("from 1 Oct").
 */
export default function DateSection({ group }: DateSectionProps) {
  // Hooks
  const copy = useCopy(filterPanelContent)

  // Event handlers
  const handlePreset = (next: string) => {
    if (next === DATE_CUSTOM) group.onChange({ ...group.value, preset: DATE_CUSTOM })
    else if (group.presets.some((p) => p.value === next)) {
      group.onChange({ preset: next, from: '', to: '' })
    } else group.onChange({ preset: null, from: '', to: '' })
  }

  // Render logic
  const custom = group.value.preset === DATE_CUSTOM

  return (
    <div className="flex flex-col gap-2">
      <NativeSelect
        className="w-full"
        aria-label={group.label}
        value={group.value.preset ?? ''}
        onChange={(e) => handlePreset(e.target.value)}
      >
        <NativeSelectOption value="">{group.anyLabel}</NativeSelectOption>
        {group.presets.map((p) => (
          <NativeSelectOption key={p.value} value={p.value}>
            {p.label}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={DATE_CUSTOM}>{copy.custom}</NativeSelectOption>
      </NativeSelect>
      {custom ? (
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">{copy.from}</span>
            <DateField
              aria-label={copy.from}
              value={group.value.from}
              max={group.value.to || undefined}
              onChange={(v) => group.onChange({ ...group.value, from: v })}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">{copy.to}</span>
            <DateField
              aria-label={copy.to}
              value={group.value.to}
              min={group.value.from || undefined}
              onChange={(v) => group.onChange({ ...group.value, to: v })}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
