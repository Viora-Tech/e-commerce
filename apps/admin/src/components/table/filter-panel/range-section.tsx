'use client'

import { Input } from '@commerce/ui/shadcn/input'
import MoneyInput from '@/components/fields/money-input'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import type { RangeGroup } from './types'

type RangeSectionProps = { group: RangeGroup }

type BoundProps = {
  input: RangeGroup['input']
  title: string
  label: string
  value: string
  onChange: (value: string) => void
}

function Bound({ input, title, label, value, onChange }: BoundProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {input === 'money' ? (
        <MoneyInput aria-label={`${title}: ${label}`} value={value} onChange={onChange} />
      ) : (
        <Input
          inputMode="numeric"
          aria-label={`${title}: ${label}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

export default function RangeSection({ group }: RangeSectionProps) {
  // Hooks
  const copy = useCopy(filterPanelContent)

  return (
    <div className="flex gap-2">
      <Bound
        input={group.input}
        title={group.label}
        label={group.fromLabel ?? copy.min}
        value={group.from}
        onChange={(from) => group.onChange({ from })}
      />
      {group.to === undefined ? null : (
        <Bound
          input={group.input}
          title={group.label}
          label={group.toLabel ?? copy.max}
          value={group.to}
          onChange={(to) => group.onChange({ to })}
        />
      )}
    </div>
  )
}
