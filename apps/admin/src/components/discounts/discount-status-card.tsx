'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'

type DiscountStatus = 'active' | 'disabled'

type DiscountStatusCardProps = {
  status: DiscountStatus
  onChange: (status: DiscountStatus) => void
}

export default function DiscountStatusCard({ status, onChange }: DiscountStatusCardProps) {
  // Hooks
  const { status: copy } = useCopy(discountFormContent)

  // Render logic
  const statusItems = Object.fromEntries(copy.options.map((o) => [o.value, o.label]))

  return (
    <DataCard title={copy.heading}>
      <Field>
        <FieldLabel htmlFor="discount-status" className="sr-only">
          {copy.label}
        </FieldLabel>
        <Select
          items={statusItems}
          value={status}
          onValueChange={(s) => onChange(s as DiscountStatus)}
        >
          <SelectTrigger id="discount-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {copy.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{copy.help[status]}</FieldDescription>
      </Field>
    </DataCard>
  )
}
