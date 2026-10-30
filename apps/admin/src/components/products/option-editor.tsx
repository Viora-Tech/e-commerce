'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import SuggestInput from '@/components/fields/suggest-input'
import TagInput from '@/components/fields/tag-input'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { Facets, OptionRow } from './form-state'

type OptionEditorProps = {
  /** Position among the options, for field ids. */
  index: number
  option: OptionRow
  /** Names the product's other options already use, not offered again. */
  otherNames: string[]
  /** Option names and values the store's other products use, offered first. */
  storeOptions: Facets['options']
  onName: (name: string) => void
  onValues: (values: string[]) => void
  onRemove: () => void
  /** Folds the editor back into its chip. */
  onDone: () => void
}

type VariantsCopy = (typeof productFormContent)['variants']

/** Common values for a well-known option name; custom names get none. */
function presetValues(copy: VariantsCopy, name: string): readonly string[] {
  const key = name.trim().toLowerCase()
  const presets = copy.optionValueSuggestions
  if (/colou?r/.test(key)) return presets.colour
  if (key.startsWith('pack')) return presets.packSize
  const known = Object.keys(presets) as (keyof typeof presets)[]
  const match = known.find((k) => k.toLowerCase() === key)
  return match ? presets[match] : []
}

/** Case-insensitive union, first spelling wins, order kept. */
function union(...lists: (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of lists.flat()) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

/** Values the store already uses for this option name, then the common ones. */
function valueSuggestions(
  copy: VariantsCopy,
  store: Facets['options'],
  name: string,
): string[] {
  const key = name.trim().toLowerCase()
  const used = store.find((o) => o.name.toLowerCase() === key)?.values ?? []
  return union(used, presetValues(copy, name))
}

/** Option names the store uses, then the common ones, minus names this product already has. */
function nameSuggestions(
  copy: VariantsCopy,
  store: Facets['options'],
  taken: string[],
): string[] {
  const own = new Set(taken.map((n) => n.trim().toLowerCase()))
  return union(
    store.map((o) => o.name),
    copy.optionNameSuggestions,
  ).filter((n) => !own.has(n.toLowerCase()))
}

/** One option opened for editing: its name, its values, remove, and Done to fold it back. */
export default function OptionEditor({
  index,
  option,
  otherNames,
  storeOptions,
  onName,
  onValues,
  onRemove,
  onDone,
}: OptionEditorProps) {
  // Hooks
  const { variants: copy } = useCopy(productFormContent)

  // Render logic
  const canFold = option.name.trim() !== '' && option.values.some((v) => v.trim())

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_2fr] md:items-start">
        <Field>
          <FieldLabel htmlFor={`option-name-${index}`}>{copy.optionName}</FieldLabel>
          <SuggestInput
            id={`option-name-${index}`}
            size="lg"
            value={option.name}
            suggestions={nameSuggestions(copy, storeOptions, otherNames)}
            onChange={onName}
            placeholder={copy.optionNamePlaceholder}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`option-values-${index}`}>{copy.optionValues}</FieldLabel>
          <TagInput
            id={`option-values-${index}`}
            tags={option.values}
            suggestions={valueSuggestions(copy, storeOptions, option.name)}
            onChange={onValues}
            placeholder={copy.optionValuesPlaceholder}
          />
          <FieldDescription>{copy.optionValuesHelp}</FieldDescription>
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
          {copy.remove}
        </Button>
        <Button type="button" size="sm" onClick={onDone} disabled={!canFold}>
          {copy.done}
        </Button>
      </div>
    </div>
  )
}
