'use client'

import {
  COLLECTION_FIELDS,
  type CollectionCondition,
  type CollectionRules,
} from '@commerce/core/collections'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { collectionFormContent as copy } from '@/data/collections'
import CollectionRuleRow from './collection-rule-row'

type CollectionRulesBuilderProps = {
  rules: CollectionRules
  /** Live count from `collections.preview`; null while it is in flight. */
  matches: number | null
  onChange: (rules: CollectionRules) => void
}

const MATCH_ITEMS = [
  { value: 'all', label: 'all conditions' },
  { value: 'any', label: 'any condition' },
]

const defaultCondition = (): CollectionCondition => ({ field: 'type', op: 'eq', value: '' })

/** Stable per-row key so editing one row does not remount its neighbours. */
function rowKey(condition: CollectionCondition, index: number): string {
  return `${index}-${condition.field}-${condition.op}`
}

/**
 * Match mode plus condition rows for an automatic collection. Shaped like the
 * segments builder but over product fields, which have their own operators.
 */
export default function CollectionRulesBuilder({
  rules,
  matches,
  onChange,
}: CollectionRulesBuilderProps) {
  // Event handlers
  const handleMatch = (value: unknown) => {
    onChange({ ...rules, match: String(value) === 'any' ? 'any' : 'all' })
  }

  const handleAdd = () => {
    onChange({ ...rules, conditions: [...rules.conditions, defaultCondition()] })
  }

  const handleRow = (index: number, next: CollectionCondition) => {
    onChange({ ...rules, conditions: rules.conditions.map((c, i) => (i === index ? next : c)) })
  }

  const handleRemove = (index: number) => {
    onChange({ ...rules, conditions: rules.conditions.filter((_, i) => i !== index) })
  }

  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-body text-muted-foreground">Products matching</span>
        <Select value={rules.match} onValueChange={handleMatch}>
          <SelectTrigger className="w-44" aria-label="Match mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_ITEMS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rules.conditions.map((condition, index) => (
        <CollectionRuleRow
          key={rowKey(condition, index)}
          condition={condition}
          fields={COLLECTION_FIELDS}
          onChange={(next) => handleRow(index, next)}
          onRemove={() => handleRemove(index)}
        />
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={handleAdd}>
          <Plus aria-hidden="true" />
          Add condition
        </Button>
        <span className="text-body text-muted-foreground tabular-nums">
          {matches === null ? copy.kind.previewing : copy.kind.preview(matches)}
        </span>
      </div>
    </div>
  )
}
