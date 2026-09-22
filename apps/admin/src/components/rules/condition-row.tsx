'use client'

import { OPS_BY_FIELD, type SegmentCondition, type SegmentField } from '@commerce/core/segments'
import { Trash2 } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import MoneyInput from '@/components/fields/money-input'
import KitIconButton from '@/components/kit/kit-icon-button'
import { segmentsContent as copy } from '@/data/customers'
import { INDIAN_STATES } from '@/data/india'

type ConditionRowProps = {
  condition: SegmentCondition
  fields: readonly SegmentField[]
  onChange: (next: SegmentCondition) => void
  onRemove: () => void
}

const stateItems = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))
const marketingItems = [
  { value: 'true', label: copy.marketingValues.true ?? 'Subscribed' },
  { value: 'false', label: copy.marketingValues.false ?? 'Not subscribed' },
]

/** Rupees in the input, paise in the rule, so spend rules compare like the list does. */
function paiseToRupees(paise: string): string {
  const n = Number.parseInt(paise, 10)
  return Number.isFinite(n) && n !== 0 ? String(n / 100) : ''
}

function rupeesToPaise(rupees: string): string {
  const n = Number.parseFloat(rupees)
  return Number.isFinite(n) ? String(Math.round(n * 100)) : ''
}

/** One field/operator/value row of a segment rule. */
export default function ConditionRow({ condition, fields, onChange, onRemove }: ConditionRowProps) {
  // Event handlers
  const handleField = (value: unknown) => {
    const field = String(value) as SegmentField
    const op = OPS_BY_FIELD[field][0] ?? 'eq'
    onChange({ field, op, value: field === 'marketing' ? 'true' : '' })
  }

  const handleOp = (value: unknown) => {
    onChange({ ...condition, op: String(value) as SegmentCondition['op'] })
  }

  const handleValue = (value: string) => {
    onChange({ ...condition, value })
  }

  // Render logic
  const ops = OPS_BY_FIELD[condition.field]
  const fieldItems = fields.map((f) => ({ value: f, label: copy.fields[f] ?? f }))
  const opItems = ops.map((o) => ({ value: o, label: copy.ops[o] ?? o }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select items={fieldItems} value={condition.field} onValueChange={handleField}>
        <SelectTrigger className="w-52" aria-label={copy.builder.conditions}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldItems.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={opItems} value={condition.op} onValueChange={handleOp}>
        <SelectTrigger className="w-36" aria-label={copy.ops[condition.op] ?? condition.op}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opItems.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {condition.field === 'state' ? (
        <Select
          items={stateItems}
          value={condition.value}
          onValueChange={(v) => handleValue(String(v ?? ''))}
        >
          <SelectTrigger className="w-52" aria-label={copy.fields.state}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stateItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : condition.field === 'marketing' ? (
        <Select
          items={marketingItems}
          value={condition.value || 'true'}
          onValueChange={(v) => handleValue(String(v ?? 'true'))}
        >
          <SelectTrigger className="w-44" aria-label={copy.fields.marketing}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {marketingItems.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : condition.field === 'spend' ? (
        <div className="w-40">
          <MoneyInput
            aria-label={copy.fields.spend}
            value={paiseToRupees(condition.value)}
            onChange={(v) => handleValue(rupeesToPaise(v))}
            placeholder={copy.valuePlaceholder.spend}
          />
        </div>
      ) : (
        <Input
          className="w-40"
          inputMode={condition.field === 'tag' ? 'text' : 'numeric'}
          aria-label={copy.fields[condition.field] ?? condition.field}
          value={condition.value}
          onChange={(e) => handleValue(e.target.value)}
          placeholder={copy.valuePlaceholder[condition.field] ?? ''}
        />
      )}

      <KitIconButton label={copy.builder.remove} onClick={onRemove}>
        <Trash2 />
      </KitIconButton>
    </div>
  )
}
