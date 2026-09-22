'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { MANUAL_REASONS, type ManualReasonValue } from '@/data/inventory'

type ReasonSelectProps = {
  id: string
  value: ManualReasonValue
  onChange: (reason: ManualReasonValue) => void
  className?: string
}

const ITEMS = Object.fromEntries(MANUAL_REASONS.map((r) => [r.value, r.label]))

/** Why stock changed by hand; logged with every manual edit. */
export default function ReasonSelect({ id, value, onChange, className }: ReasonSelectProps) {
  return (
    <Select
      items={ITEMS}
      value={value}
      onValueChange={(next) => onChange(String(next) as ManualReasonValue)}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MANUAL_REASONS.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
