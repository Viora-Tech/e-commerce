'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { productFormContent } from '@/data/products'
import { MAX_OPTIONS, type OptionRow, type VariantRow } from './form-state'
import VariantMatrix from './variant-matrix'

type VariantsCardProps = {
  options: OptionRow[]
  variants: VariantRow[]
  error?: string | undefined
  onOptions: (options: OptionRow[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
}

const copy = productFormContent.variants

/** "Small, Medium , Large" → ["Small", "Medium", "Large"], duplicates dropped. */
function parseValues(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(',')
    .map((v) => v.trim())
    .filter((v) => {
      const k = v.toLowerCase()
      if (!v || seen.has(k)) return false
      seen.add(k)
      return true
    })
}

export default function VariantsCard({
  options,
  variants,
  error,
  onOptions,
  onVariant,
}: VariantsCardProps) {
  // Hooks
  // Raw comma text per option, so a trailing comma survives typing.
  const [valueText, setValueText] = useState<string[]>(() =>
    options.map((o) => o.values.join(', ')),
  )

  // Helpers
  const setOption = (i: number, patch: Partial<OptionRow>) =>
    onOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const addOption = () => {
    setValueText((t) => [...t, ''])
    onOptions([...options, { name: '', values: [] }])
  }

  const removeOption = (i: number) => {
    setValueText((t) => t.filter((_, j) => j !== i))
    onOptions(options.filter((_, j) => j !== i))
  }

  // Event handlers
  const handleValues = (i: number, text: string) => {
    setValueText((t) => t.map((x, j) => (j === i ? text : x)))
    setOption(i, { values: parseValues(text) })
  }

  // Render logic
  const hasOptions = options.length > 0
  const atMax = options.length >= MAX_OPTIONS

  return (
    <Card size="form" className="pb-0">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        {hasOptions ? (
          <span className="text-sm text-muted-foreground">{copy.count(variants.length)}</span>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-(--card-spacing)">
        {options.map((o, i) => (
          <div
            key={o.id ?? `new-${i}`}
            className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_2fr_auto] md:items-start"
          >
            <Field>
              <FieldLabel htmlFor={`option-name-${i}`}>{copy.optionName}</FieldLabel>
              <Input
                size="lg"
                id={`option-name-${i}`}
                value={o.name}
                onChange={(e) => setOption(i, { name: e.target.value })}
                placeholder={copy.optionNamePlaceholder}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`option-values-${i}`}>{copy.optionValues}</FieldLabel>
              <Input
                size="lg"
                id={`option-values-${i}`}
                value={valueText[i] ?? ''}
                onChange={(e) => handleValues(i, e.target.value)}
                placeholder={copy.optionValuesPlaceholder}
                autoComplete="off"
              />
              <FieldDescription>{copy.optionValuesHelp}</FieldDescription>
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive md:mt-6"
              onClick={() => removeOption(i)}
              aria-label={copy.remove}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={atMax}>
            <Plus />
            {hasOptions ? copy.addAnother : copy.addOption}
          </Button>
          {atMax ? <span className="text-xs text-muted-foreground">{copy.maxOptions}</span> : null}
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        {variants.length > 30 ? (
          <p className="text-xs text-muted-foreground">{copy.tooMany(variants.length)}</p>
        ) : null}
      </CardContent>
      {hasOptions ? <VariantMatrix variants={variants} onVariant={onVariant} /> : null}
    </Card>
  )
}
