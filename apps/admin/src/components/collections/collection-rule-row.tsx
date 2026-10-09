'use client'

import {
  COLLECTION_OPS_BY_FIELD,
  type CollectionCondition,
  type CollectionField,
} from '@commerce/core/collections'
import { Trash2 } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import KitIconButton from '@/components/kit/kit-icon-button'
import { collectionFormContent as copy, FIELD_LABELS, OP_LABELS } from '@/data/collections'

type CollectionRuleRowProps = {
  condition: CollectionCondition
  fields: readonly CollectionField[]
  onChange: (next: CollectionCondition) => void
  onRemove: () => void
}

/** One field/operator/value row of an automatic collection's rules. */
export default function CollectionRuleRow({
  condition,
  fields,
  onChange,
  onRemove,
}: CollectionRuleRowProps) {
  // Event handlers
  const handleField = (value: unknown) => {
    const field = String(value) as CollectionField
    const ops = COLLECTION_OPS_BY_FIELD[field]
    const op = ops.includes(condition.op) ? condition.op : (ops[0] ?? 'eq')
    onChange({ field, op, value: '' })
  }

  const handleOp = (value: unknown) => {
    onChange({ ...condition, op: String(value) as CollectionCondition['op'] })
  }

  const handleValue = (value: string) => {
    onChange({ ...condition, value })
  }

  // Render logic
  const ops = COLLECTION_OPS_BY_FIELD[condition.field]

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-2">
      <Select value={condition.field} onValueChange={handleField}>
        <SelectTrigger className="w-40 bg-card" aria-label={FIELD_LABELS[condition.field]}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f} value={f}>
              {FIELD_LABELS[f]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={condition.op} onValueChange={handleOp}>
        <SelectTrigger className="w-44 bg-card" aria-label={OP_LABELS[condition.op]}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o} value={o}>
              {OP_LABELS[o]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="min-w-40 flex-1 bg-card"
        value={condition.value}
        inputMode={condition.field === 'price' ? 'decimal' : 'text'}
        onChange={(e) => handleValue(e.target.value)}
        aria-label={FIELD_LABELS[condition.field]}
      />
      <KitIconButton label={copy.products.remove} onClick={onRemove}>
        <Trash2 aria-hidden="true" />
      </KitIconButton>
    </div>
  )
}
