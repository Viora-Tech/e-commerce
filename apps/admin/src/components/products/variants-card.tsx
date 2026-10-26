'use client'

import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import SuggestInput from '@/components/fields/suggest-input'
import TagInput from '@/components/fields/tag-input'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import {
  type Facets,
  MAX_OPTIONS,
  type MediaItem,
  matrixOptions,
  type OptionRow,
  reconcileVariants,
  stockOf,
  suggestSku,
  type VariantRow,
} from './form-state'
import { generateSku } from './sku'
import VariantBulkBar, { type VariantBulkPatch } from './variant-bulk-bar'
import VariantMatrix from './variant-matrix'

type VariantsCardProps = {
  title: string
  options: OptionRow[]
  variants: VariantRow[]
  /** Gallery, so a variant can use its images. */
  media: MediaItem[]
  /** Option names and values the store's other products use, offered first. */
  facets?: Facets | undefined
  error?: string | undefined
  onOptions: (options: OptionRow[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
  /** Files uploaded from a variant's images dialog join the product gallery. */
  onAddMedia: (items: MediaItem[]) => void
}

type VariantsCopy = (typeof productFormContent)['variants']

type StoreOptions = Facets['options']

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
function valueSuggestions(copy: VariantsCopy, store: StoreOptions, name: string): string[] {
  const key = name.trim().toLowerCase()
  const used = store.find((o) => o.name.toLowerCase() === key)?.values ?? []
  return union(used, presetValues(copy, name))
}

/** Option names the store uses, then the common ones, minus names this product already has. */
function nameSuggestions(copy: VariantsCopy, store: StoreOptions, taken: string[]): string[] {
  const own = new Set(taken.map((n) => n.trim().toLowerCase()))
  return union(
    store.map((o) => o.name),
    copy.optionNameSuggestions,
  ).filter((n) => !own.has(n.toLowerCase()))
}

export default function VariantsCard({
  title,
  options,
  variants,
  media,
  facets,
  error,
  onOptions,
  onVariant,
  onAddMedia,
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
    const taken = variants.map((v) => v.sku)
    variants.forEach((v, i) => {
      if (v.sku.trim()) return
      const sku = generateSku(title, v.optionValues, taken)
      taken[i] = sku
      onVariant(i, { sku })
    })
  }

  const handleGenerateSku = (index: number) => {
    const row = variants[index]
    if (!row) return
    const taken = variants.filter((_, j) => j !== index).map((v) => v.sku)
    onVariant(index, { sku: generateSku(title, row.optionValues, taken) })
  }

  // Render logic
  const hasOptions = options.length > 0
  const hasMatrix = matrixOptions(options).length > 0
  const atMax = options.length >= MAX_OPTIONS
  const pendingDropped = pending ? reconcileVariants(pending, options, variants).dropped : []
  const waiting = options.some((o) => !o.values.some((v) => v.trim()))
  const storeOptions = facets?.options ?? []

  return (
    <DataCard
      title={
        <>
          {copy.heading}
          {hasOptions ? (
            <StatusChip tone="neutral">{copy.count(variants.length)}</StatusChip>
          ) : null}
        </>
      }
      action={
        <>
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
        </>
      }
      className="pb-0"
      bodyClassName="flex flex-col gap-4 pb-(--card-spacing)"
    >
      {options.map((o, i) => (
        <div
          key={o.id ?? `new-${i}`}
          className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start"
        >
          <Field>
            <FieldLabel htmlFor={`option-name-${i}`}>{copy.optionName}</FieldLabel>
            <SuggestInput
              id={`option-name-${i}`}
              size="lg"
              value={o.name}
              suggestions={nameSuggestions(
                copy,
                storeOptions,
                options.filter((_, j) => j !== i).map((other) => other.name),
              )}
              onChange={(name) => setOption(i, { name })}
              placeholder={copy.optionNamePlaceholder}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`option-values-${i}`}>{copy.optionValues}</FieldLabel>
            <TagInput
              id={`option-values-${i}`}
              tags={o.values}
              suggestions={valueSuggestions(copy, storeOptions, o.name)}
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
      {atMax ? <span className="text-xs text-muted-foreground">{copy.maxOptions}</span> : null}
      {waiting && !error ? (
        <p className="text-caption text-muted-foreground">{copy.needsValues}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      {variants.length > 30 ? (
        <p className="text-xs text-muted-foreground">{copy.tooMany(variants.length)}</p>
      ) : null}
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
          onAddMedia={onAddMedia}
          onGenerateSku={handleGenerateSku}
        />
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy.confirmRemoveTitle}
        body={copy.confirmRemoveBody(pendingDropped.length, stockOf(pendingDropped))}
        confirmLabel={copy.confirmRemoveConfirm}
        cancelLabel={copy.confirmRemoveCancel}
        onConfirm={handleConfirmRemove}
      />
    </DataCard>
  )
}
