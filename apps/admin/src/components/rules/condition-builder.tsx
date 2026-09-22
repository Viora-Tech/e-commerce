'use client'

import {
  defaultCondition,
  SEGMENT_FIELDS,
  type SegmentCondition,
  type SegmentMatch,
  type SegmentRules,
} from '@commerce/core/segments'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { segmentsContent as copy } from '@/data/customers'
import ConditionRow from './condition-row'

/** Stable per-row key so editing one row does not remount its neighbours. */
function rowKey(condition: SegmentCondition, index: number): string {
  return `${index}-${condition.field}-${condition.op}`
}

type ConditionBuilderProps = {
  rules: SegmentRules
  onChange: (rules: SegmentRules) => void
}

const matchItems = [
  { value: 'all', label: copy.builder.matchAll },
  { value: 'any', label: copy.builder.matchAny },
]

/** Match mode plus a list of condition rows; the rule shape comes straight from core. */
export default function ConditionBuilder({ rules, onChange }: ConditionBuilderProps) {
  // Event handlers
  const handleMatch = (value: unknown) => {
    onChange({ ...rules, match: (String(value) as SegmentMatch) || 'all' })
  }

  const handleAdd = () => {
    onChange({ ...rules, conditions: [...rules.conditions, defaultCondition()] })
  }

  const handleRow = (index: number, next: SegmentCondition) => {
    onChange({ ...rules, conditions: rules.conditions.map((c, i) => (i === index ? next : c)) })
  }

  const handleRemove = (index: number) => {
    onChange({ ...rules, conditions: rules.conditions.filter((_, i) => i !== index) })
  }

  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-body text-muted-foreground">{copy.builder.match}</span>
        <Select items={matchItems} value={rules.match} onValueChange={handleMatch}>
          <SelectTrigger className="w-44" aria-label={copy.builder.match}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {matchItems.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rules.conditions.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.builder.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.conditions.map((condition, index) => (
            <ConditionRow
              key={rowKey(condition, index)}
              condition={condition}
              fields={SEGMENT_FIELDS}
              onChange={(next) => handleRow(index, next)}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}

      <div>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus />
          {copy.builder.add}
        </Button>
      </div>
    </div>
  )
}
