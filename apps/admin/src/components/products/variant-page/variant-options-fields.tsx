'use client'

import { FieldError } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import KitField from '@/components/kit/kit-field'
import { variantPageContent } from '@/data/variant-page'
import { useCopy } from '@/hooks/use-copy'
import type { OptionRow, VariantRow } from '../form-state'
import SwitchRow from './switch-row'

type VariantOptionsFieldsProps = {
  options: OptionRow[]
  draft: VariantRow
  /** The title of another variant that already has these values; Save waits until it is fixed. */
  clash: string | null
  onPatch: (patch: Partial<VariantRow>) => void
}

/**
 * The variant page's Options card: which value of each option this variant is (picked from the
 * product's values, so the matrix stays whole), and whether shoppers can see it.
 */
export default function VariantOptionsFields({
  options,
  draft,
  clash,
  onPatch,
}: VariantOptionsFieldsProps) {
  // Hooks
  const copy = useCopy(variantPageContent)

  // Event handlers
  const handleValue = (index: number, value: string) =>
    onPatch({ optionValues: draft.optionValues.map((v, i) => (i === index ? value : v)) })

  // Render logic
  const fields = copy.fields

  return (
    <div className="flex flex-col gap-4">
      {options.length === 0 ? (
        <p className="text-caption text-muted-foreground">{copy.options.none}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {options.map((option, i) => {
              const values = option.values.filter((v) => v.trim())
              const current = draft.optionValues[i] ?? ''
              // A value since removed from the option still shows until another is picked.
              const all = values.includes(current) || !current ? values : [current, ...values]
              return (
                <KitField
                  key={option.id ?? option.name}
                  label={option.name}
                  htmlFor={`variant-option-${i}`}
                >
                  <Select
                    items={Object.fromEntries(all.map((v) => [v, v]))}
                    value={current}
                    onValueChange={(next) => handleValue(i, String(next))}
                  >
                    <SelectTrigger size="lg" id={`variant-option-${i}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {all.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </KitField>
              )
            })}
          </div>
          {clash ? (
            <FieldError>{copy.options.taken(clash)}</FieldError>
          ) : (
            <p className="text-caption text-muted-foreground">{copy.options.help}</p>
          )}
        </>
      )}
      <SwitchRow
        id="variant-hidden"
        label={fields.hide}
        help={fields.hideHelp}
        checked={draft.hiddenOnStore}
        onChange={(hiddenOnStore) => onPatch({ hiddenOnStore })}
      />
    </div>
  )
}
