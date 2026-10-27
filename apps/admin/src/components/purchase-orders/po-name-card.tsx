'use client'

import { Field, FieldDescription } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DataCard from '@/components/layout/data-card'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'

type PoNameCardProps = {
  value: string
  disabled: boolean
  onChange: (name: string) => void
}

/** The merchant's own name for the order ("Diwali restock"), shown beside its number. */
export default function PoNameCard({ value, disabled, onChange }: PoNameCardProps) {
  // Hooks
  const { name: copy } = useCopy(purchaseOrderFormContent)

  // Render logic
  return (
    <DataCard title={copy.label}>
      <Field>
        <Input
          id="po-name"
          aria-label={copy.label}
          value={value}
          maxLength={120}
          placeholder={copy.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <FieldDescription>{copy.hint}</FieldDescription>
      </Field>
    </DataCard>
  )
}
