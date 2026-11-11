'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldError } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import {
  type Facets,
  MAX_OPTIONS,
  type MediaItem,
  type OptionRow,
  type ProductFormState,
  stockOf,
  suggestSku,
  type VariantRow,
  variantPreorderContext,
} from './form-state'
import OptionChip from './option-chip'
import OptionEditor from './option-editor'
import type { ProductTax } from './product-tax'
import { generateSku } from './sku'
import VariantBulkBar, { type VariantBulkPatch } from './variant-bulk-bar'
import { defaultGroupBy, matrixLines } from './variant-groups'
import VariantMatrix from './variant-matrix'
import { matrixOptions, reconcileVariants } from './variant-reconcile'
import VariantToolbar from './variant-toolbar'

type VariantsCardProps = {
  title: string
  options: OptionRow[]
  variants: VariantRow[]
  /** Gallery, so a variant can use its images. */
  media: MediaItem[]
  /** The product's HSN and GST rate, for the variant dialog (#63). */
  tax: ProductTax
  /** The product's pre-order switch, campaign and limit, for the variant dialog's pre-order limit. */
  preorder: Pick<
    ProductFormState,
    'preorderEnabled' | 'preorderCampaignId' | 'preorderOwn' | 'preorderLimit'
  >
  /** Option names and values the store's other products use, offered first. */
  facets?: Facets | undefined
  error?: string | undefined
  onOptions: (options: OptionRow[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
  /** Removes these rows (bulk Delete); the options keep their values. */
  onRemoveVariants: (indexes: number[]) => void
  /** Files uploaded from a variant's images dialog join the product gallery. */
  onAddMedia: (items: MediaItem[]) => void
}

/** An option still being set up (no name or no value) stays open; a chip would hide the gap. */
const unfinished = (o: OptionRow) => !o.name.trim() || !o.values.some((v) => v.trim())

export default function VariantsCard({
  title,
  options,
  variants,
  media,
  tax,
  preorder,
  facets,
  error,
  onOptions,
  onVariant,
  onRemoveVariants,
  onAddMedia,
}: VariantsCardProps) {
  // Hooks
  const { variants: copy, variantBulk: bulkCopy } = useCopy(productFormContent)
  const [selected, setSelected] = useState<number[]>([])
  /** Options change pending a "this drops stock" confirmation. */
  const [pending, setPending] = useState<OptionRow[] | null>(null)
  /** The option opened from its chip. */
  const [editing, setEditing] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  /** Option index to group by; `undefined` until the merchant picks, then the default applies. */
  const [groupChoice, setGroupChoice] = useState<number | null | undefined>(undefined)
  /** Group values opened to their variants. */
  const [openGroups, setOpenGroups] = useState<string[]>([])
  /** Bulk Delete waiting on its confirmation. */
  const [confirmDelete, setConfirmDelete] = useState(false)

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
  const handleAddOption = () => {
    onOptions([...options, { name: '', values: [] }])
    setEditing(options.length)
  }

  const handleRemoveOption = (i: number) => {
    propose(options.filter((_, j) => j !== i))
    setEditing(null)
    setGroupChoice(undefined)
    setOpenGroups([])
  }

  const handleValues = (i: number, values: string[]) =>
    propose(options.map((o, j) => (j === i ? { ...o, values } : o)))

  const handleConfirmRemove = () => {
    if (pending) onOptions(pending)
    setPending(null)
    setSelected([])
  }

  const handleGroupBy = (next: number | null) => {
    setGroupChoice(next)
    setOpenGroups([])
  }

  const handleToggleGroup = (value: string) =>
    setOpenGroups((now) => (now.includes(value) ? now.filter((v) => v !== value) : [...now, value]))

  const handleBulkApply = ({ price, mrp, quantity, skuPrefix }: VariantBulkPatch) => {
    for (const index of selected) {
      const row = variants[index]
      if (!row) continue
      onVariant(index, {
        ...(price === undefined ? {} : { price }),
        ...(mrp === undefined ? {} : { mrp }),
        ...(quantity === undefined || !row.trackInventory ? {} : { quantity }),
        ...(skuPrefix === undefined ? {} : { sku: suggestSku(skuPrefix, row.optionValues) }),
      })
    }
  }

  const handleBulkDelete = () => {
    onRemoveVariants(selected)
    setSelected([])
    setConfirmDelete(false)
  }

  /** Fills missing SKUs: on the selected rows, or on every row from the card's own button. */
  const handleAutoFillSku = (only?: number[]) => {
    const taken = variants.map((v) => v.sku)
    variants.forEach((v, i) => {
      if (only && !only.includes(i)) return
      if (v.sku.trim()) return
      const sku = generateSku(title, v.optionValues, taken)
      taken[i] = sku
      onVariant(i, { sku })
    })
  }

  // Render logic
  const hasOptions = options.length > 0
  const built = matrixOptions(options)
  const hasMatrix = built.length > 0
  const atMax = options.length >= MAX_OPTIONS
  const pendingDropped = pending ? reconcileVariants(pending, options, variants).dropped : []
  const waiting = options.some((o) => !o.values.some((v) => v.trim()))
  const storeOptions = facets?.options ?? []
  const picked =
    groupChoice === undefined ? defaultGroupBy(built.length, variants.length) : groupChoice
  const groupBy = picked != null && picked < built.length && built.length >= 2 ? picked : null
  const lines = matrixLines(variants, { query, groupBy, open: openGroups })
  const deletingAll = selected.length >= variants.length
  const selectedNames = selected
    .map((i) => variants[i])
    .filter((v): v is VariantRow => Boolean(v))
    .map((v) => v.optionValues.join(' / '))
  const shownNames =
    selectedNames.length > 6
      ? `${selectedNames.slice(0, 6).join(', ')} +${selectedNames.length - 6}`
      : selectedNames.join(', ')

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
              onClick={() => handleAutoFillSku()}
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
      {hasOptions ? (
        <div className="flex flex-col gap-2">
          {options.map((o, i) =>
            editing === i || unfinished(o) ? (
              <OptionEditor
                key={o.id ?? `new-${i}`}
                index={i}
                option={o}
                otherNames={options.filter((_, j) => j !== i).map((other) => other.name)}
                storeOptions={storeOptions}
                onName={(name) => setOption(i, { name })}
                onValues={(values) => handleValues(i, values)}
                onRemove={() => handleRemoveOption(i)}
                onDone={() => setEditing(null)}
              />
            ) : (
              <OptionChip key={o.id ?? `new-${i}`} option={o} onEdit={() => setEditing(i)} />
            ),
          )}
        </div>
      ) : null}
      {atMax ? <span className="text-xs text-muted-foreground">{copy.maxOptions}</span> : null}
      {waiting && !error ? (
        <p className="text-caption text-muted-foreground">{copy.needsValues}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      {variants.length > 30 ? (
        <p className="text-xs text-muted-foreground">{copy.tooMany(variants.length)}</p>
      ) : null}
      {hasMatrix ? (
        <VariantToolbar
          query={query}
          optionNames={built.map((o) => o.name)}
          groupBy={groupBy}
          stock={stockOf(variants)}
          variantCount={variants.length}
          onQuery={setQuery}
          onGroupBy={handleGroupBy}
        />
      ) : null}
      {hasMatrix && selected.length > 0 ? (
        <VariantBulkBar
          count={selected.length}
          onApply={handleBulkApply}
          onGenerateSkus={() => handleAutoFillSku(selected)}
          onDelete={() => setConfirmDelete(true)}
          onClear={() => setSelected([])}
        />
      ) : null}
      {hasMatrix ? (
        <VariantMatrix
          productTitle={title}
          variants={variants}
          lines={lines}
          media={media}
          tax={tax}
          preorder={variantPreorderContext(preorder)}
          selected={selected}
          onSelectedChange={setSelected}
          onToggleGroup={handleToggleGroup}
          onVariant={onVariant}
          onAddMedia={onAddMedia}
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
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={bulkCopy.deleteTitle(selected.length)}
        body={deletingAll ? bulkCopy.deleteAll : bulkCopy.deleteBody(shownNames)}
        confirmLabel={bulkCopy.deleteConfirm(selected.length)}
        cancelLabel={bulkCopy.deleteKeep}
        tone="destructive"
        confirmDisabled={deletingAll}
        onConfirm={handleBulkDelete}
      />
    </DataCard>
  )
}
