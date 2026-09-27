'use client'

import { Plus, Trash2 } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import SuggestInput from '@/components/fields/suggest-input'
import TagInput from '@/components/fields/tag-input'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import {
  MAX_OPTIONS,
  type MediaItem,
  matrixOptions,
  type OptionRow,
  reconcileVariants,
  stockOf,
  suggestSku,
  type VariantRow,
} from './form-state'
import VariantBulkBar, { type VariantBulkPatch } from './variant-bulk-bar'
import VariantMatrix from './variant-matrix'

type VariantsCardProps = {
  title: string
  options: OptionRow[]
  variants: VariantRow[]
  /** Gallery, so a variant can point at one of its images. */
  media: MediaItem[]
  error?: string | undefined
  onOptions: (options: OptionRow[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
}

type VariantsCopy = (typeof productFormContent)['variants']

/** Suggested chip values for a known option name (Size/Colour/Material); custom names get none. */
function valueSuggestions(copy: VariantsCopy, name: string): readonly string[] {
  const key = name.trim().toLowerCase()
  if (key === 'size') return copy.optionValueSuggestions.size
  if (/colou?r/.test(key)) return copy.optionValueSuggestions.colour
  if (key === 'material') return copy.optionValueSuggestions.material
  return []
}

export default function VariantsCard({
  title,
  options,
  variants,
  media,
  error,
  onOptions,
  onVariant,
}: VariantsCardProps) {
  // Hooks
  const { variants: copy } = useCopy(productFormContent)
  const [selected, setSelected] = useState<number[]>([])
  /** Options change pending a "this drops stock" confirmation. */
  const [pending, setPending] = useState<OptionRow[] | null>(null)

  // Helpers
  /** Applies an options edit, asking first when it would remove variants that still hold stock. */
  const propose = (next: OptionRow[]) => {
    if (stockOf(reconcileVariants(next, options, variants).dropped) > 0) {
      setPending(next)
      return
    }
    onOptions(next)
    setSelected([])
  }
  const setOption = (i: number, patch: Partial<OptionRow>) =>
    onOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  // Event handlers
  const handleAddOption = () => onOptions([...options, { name: '', values: [] }])

  const handleRemoveOption = (i: number) => propose(options.filter((_, j) => j !== i))

  const handleValues = (i: number, values: string[]) =>
    propose(options.map((o, j) => (j === i ? { ...o, values } : o)))

  const handleConfirmRemove = () => {
    if (pending) onOptions(pending)
    setPending(null)
    setSelected([])
  }

  const handleBulkApply = ({ price, quantity, skuPrefix }: VariantBulkPatch) => {
    for (const index of selected) {
      const row = variants[index]
      if (!row) continue
      onVariant(index, {
        ...(price === undefined ? {} : { price }),
        ...(quantity === undefined || !row.trackInventory ? {} : { quantity }),
        ...(skuPrefix === undefined ? {} : { sku: suggestSku(skuPrefix, row.optionValues) }),
      })
    }
  }

  const handleAutoFillSku = () => {
    variants.forEach((v, i) => {
      if (v.sku.trim()) return
      onVariant(i, { sku: suggestSku(title, v.optionValues) })
    })
  }

  // Render logic
  const hasOptions = options.length > 0
  const hasMatrix = matrixOptions(options).length > 0
  const atMax = options.length >= MAX_OPTIONS
  const pendingDropped = pending ? reconcileVariants(pending, options, variants).dropped : []
  const waiting = options.some((o) => !o.values.some((v) => v.trim()))

  return (
    <Card size="form" className="pb-0">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        {hasOptions ? (
          <span className="text-body text-muted-foreground">{copy.count(variants.length)}</span>
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
              <SuggestInput
                id={`option-name-${i}`}
                size="lg"
                value={o.name}
                suggestions={copy.optionNameSuggestions}
                onChange={(name) => setOption(i, { name })}
                placeholder={copy.optionNamePlaceholder}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`option-values-${i}`}>{copy.optionValues}</FieldLabel>
              <TagInput
                id={`option-values-${i}`}
                tags={o.values}
                suggestions={valueSuggestions(copy, o.name)}
                onChange={(values) => handleValues(i, values)}
                placeholder={copy.optionValuesPlaceholder}
              />
              <FieldDescription>{copy.optionValuesHelp}</FieldDescription>
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive md:mt-6"
              onClick={() => handleRemoveOption(i)}
              aria-label={copy.remove}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            disabled={atMax}
          >
            <Plus />
            {hasOptions ? copy.addAnother : copy.addOption}
          </Button>
          {hasMatrix ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAutoFillSku}
              title={copy.autoFillSkuHelp}
            >
              {copy.autoFillSku}
            </Button>
          ) : null}
          {atMax ? <span className="text-xs text-muted-foreground">{copy.maxOptions}</span> : null}
        </div>
        {waiting && !error ? (
          <p className="text-caption text-muted-foreground">{copy.needsValues}</p>
        ) : null}
        {error ? <FieldError>{error}</FieldError> : null}
        {variants.length > 30 ? (
          <p className="text-xs text-muted-foreground">{copy.tooMany(variants.length)}</p>
        ) : null}
      </CardContent>
      {hasMatrix && selected.length > 0 ? (
        <VariantBulkBar
          count={selected.length}
          onApply={handleBulkApply}
          onClear={() => setSelected([])}
        />
      ) : null}
      {hasMatrix ? (
        <VariantMatrix
          variants={variants}
          media={media}
          selected={selected}
          onSelectedChange={setSelected}
          onVariant={onVariant}
        />
      ) : null}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmRemoveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.confirmRemoveBody(pendingDropped.length, stockOf(pendingDropped))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.confirmRemoveCancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/90"
              onClick={handleConfirmRemove}
            >
              {copy.confirmRemoveConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
