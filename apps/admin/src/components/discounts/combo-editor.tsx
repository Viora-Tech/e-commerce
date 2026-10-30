'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import MoneyInput from '@/components/fields/money-input'
import RadioOption from '@/components/fields/radio-option'
import PickedField from '@/components/pickers/picked-field'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { ComboFormRow } from './form-state'
import { type ComboKind, comboTabs, loadComboPicked } from './pick-sources'

type ComboEditorProps = {
  combo: ComboFormRow
  /** 1-based, for "Combo 2". */
  position: number
  /** What is wrong with this combo after a save attempt; null when nothing. */
  error: string | null
  /** Hidden for the last combo left: a combo deal keeps at least one. */
  canRemove: boolean
  onChange: (next: ComboFormRow) => void
  onRemove: () => void
}

const METHODS = ['price', 'percent', 'fixed'] as const

/** One combo of a combo deal: its items with quantities, and its own discount. */
export default function ComboEditor({
  combo,
  position,
  error,
  canRemove,
  onChange,
  onRemove,
}: ComboEditorProps) {
  // Hooks
  const all = useCopy(discountFormContent)
  const locale = useLocale()

  // Helpers
  const setQuantity = (id: string, quantity: string) =>
    onChange({ ...combo, quantities: { ...combo.quantities, [id]: quantity } })

  // Event handlers
  const handleItems = (next: { kind: string; ids: string[] }) =>
    onChange({ ...combo, scope: next.kind as ComboKind, ids: next.ids })

  // Render logic
  const copy = all.combos
  const isPercent = combo.method === 'percent'
  const id = `combo-${position}`
  const rowExtra = (p: PickItem) => (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      placeholder="1"
      aria-label={copy.quantityFor(p.title)}
      value={combo.quantities[p.id] ?? ''}
      onChange={(e) => setQuantity(p.id, e.target.value)}
    />
  )

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
      data-invalid={error ? true : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-body-strong">
          {copy.comboTitle(position)}
        </h3>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copy.remove(position)}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
      <Field>
        <FieldLabel>{copy.itemsLabel}</FieldLabel>
        <PickedField
          kind={combo.scope}
          ids={combo.ids}
          tabs={comboTabs(all.value, copy, locale)}
          title={copy.pickerTitle}
          search={combo.scope === 'variants' ? copy.variantSearch : all.value.productSearch}
          labels={all.value}
          loadPicked={(k, missing) =>
            loadComboPicked(k as ComboKind, missing, all.value, locale)
          }
          onChange={handleItems}
          rowExtra={rowExtra}
        />
      </Field>
      <Field>
        <FieldLabel>{copy.discountLabel}</FieldLabel>
        <RadioGroup
          value={combo.method}
          onValueChange={(v) => onChange({ ...combo, method: v as ComboFormRow['method'] })}
          className="gap-2"
        >
          {METHODS.map((m) => (
            <RadioOption key={m} id={`${id}-${m}`} value={m} label={copy.methods[m]} />
          ))}
        </RadioGroup>
      </Field>
      <Field className="max-w-xs">
        <MoneyInput
          size="lg"
          aria-label={copy.methods[combo.method]}
          value={combo.value}
          onChange={(value) => onChange({ ...combo, value })}
          currency={!isPercent}
          suffix={isPercent ? '%' : undefined}
          invalid={error ? true : undefined}
        />
        {combo.method === 'price' ? <FieldDescription>{copy.priceHelp}</FieldDescription> : null}
      </Field>
      {error ? <FieldError>{error}</FieldError> : null}
    </section>
  )
}
