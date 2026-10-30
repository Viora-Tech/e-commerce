'use client'

import { MAX_COMBOS } from '@commerce/core/discounts'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldDescription, FieldError } from '@commerce/ui/shadcn/field'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import ComboEditor from './combo-editor'
import { comboErrors } from './form-input'
import { type ComboFormRow, type DiscountFormState, emptyCombo } from './form-state'

type CombosCardProps = {
  form: Pick<DiscountFormState, 'combos'>
  /** Set after a save attempt; each combo then shows its own problem. */
  error?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

/** Combo deal: Combo 1..N, each a set of items with its own discount, and "Add combo". */
export default function CombosCard({ form, error, onChange }: CombosCardProps) {
  // Hooks
  const all = useCopy(discountFormContent)

  // Helpers
  const setCombos = (combos: ComboFormRow[]) => onChange({ combos })

  // Event handlers
  const handleAdd = () => setCombos([...form.combos, emptyCombo()])

  const handleChange = (index: number, next: ComboFormRow) =>
    setCombos(form.combos.map((c, i) => (i === index ? next : c)))

  const handleRemove = (index: number) => setCombos(form.combos.filter((_, i) => i !== index))

  // Render logic
  const copy = all.combos
  const perCombo = error ? comboErrors(form, all.errors) : []
  const full = form.combos.length >= MAX_COMBOS

  return (
    <DataCard
      title={copy.heading}
      bodyClassName="flex flex-col gap-4"
      footer={
        <Button type="button" variant="outline" disabled={full} onClick={handleAdd}>
          <Plus aria-hidden="true" />
          {copy.add}
        </Button>
      }
    >
      <FieldDescription>{copy.help}</FieldDescription>
      {form.combos.map((combo, i) => (
        <ComboEditor
          // biome-ignore lint/suspicious/noArrayIndexKey: combos have no id; "Combo 2" is a position
          key={i}
          combo={combo}
          position={i + 1}
          error={perCombo[i] ?? null}
          canRemove={form.combos.length > 1}
          onChange={(next) => handleChange(i, next)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      {full ? <FieldDescription>{copy.max(MAX_COMBOS)}</FieldDescription> : null}
      {error && perCombo.every((e) => e === null) ? <FieldError>{error}</FieldError> : null}
    </DataCard>
  )
}
