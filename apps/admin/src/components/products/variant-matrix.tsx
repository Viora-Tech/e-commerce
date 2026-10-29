'use client'

import { variantTitle } from '@commerce/core/catalog'
import { Pencil } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import StatusChip from '@/components/layout/status-chip'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { bestMargin } from '@/lib/variant-margin'
import type { MediaItem, VariantRow } from './form-state'
import { generateSku } from './sku'
import VariantEditDialog from './variant-edit-dialog'
import VariantImagePicker from './variant-image-picker'
import ZeroPriceWarning from './zero-price-warning'

type VariantMatrixProps = {
  /** The product's title, the stem of a generated SKU. */
  productTitle: string
  variants: VariantRow[]
  media: MediaItem[]
  selected: number[]
  onSelectedChange: (next: number[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
  /** Files uploaded from a variant's images dialog join the product gallery. */
  onAddMedia: (items: MediaItem[]) => void
}

/** Same grid as ResourceTable: white 40px header on a hairline, rows on lighter hairlines. */
const HEAD =
  'h-10 border-b border-border bg-muted px-3 text-table-head text-muted-foreground first:pl-5 last:pr-5'
const CELL = 'border-b border-line px-3 py-2 text-body first:pl-5 last:pr-5'

const rowKey = (v: VariantRow) => v.id ?? variantTitle(v.optionValues)

/**
 * One row per option combination, edited in place: price, MRP, SKU and stock. Rows are
 * selectable for bulk edits; Edit opens a dialog with the rest of the variant's fields.
 */
export default function VariantMatrix({
  productTitle,
  variants,
  media,
  selected,
  onSelectedChange,
  onVariant,
  onAddMedia,
}: VariantMatrixProps) {
  // Hooks
  const {
    variants: { columns: copy, footer, ...variantsCopy },
    variantBulk: bulkCopy,
    inventory: inventoryCopy,
  } = useCopy(productFormContent)
  const fmt = useFormat()
  /** The row whose dialog is open. */
  const [editing, setEditing] = useState<number | null>(null)

  // Event handlers
  const handleToggleAll = (checked: boolean) => {
    onSelectedChange(checked ? variants.map((_, i) => i) : [])
  }

  const handleGenerateSku = (index: number) => {
    const row = variants[index]
    if (!row) return
    const taken = variants.filter((_, j) => j !== index).map((v) => v.sku)
    onVariant(index, { sku: generateSku(productTitle, row.optionValues, taken) })
  }

  const handleToggleRow = (index: number, checked: boolean) => {
    onSelectedChange(checked ? [...selected, index] : selected.filter((i) => i !== index))
  }

  // Render logic
  const allSelected = variants.length > 0 && selected.length === variants.length
  const units = variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
  const best = bestMargin(variants)

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[52rem] border-separate border-spacing-0">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD, 'w-10')}>
              <Checkbox
                aria-label={bulkCopy.selectAll}
                checked={allSelected}
                onCheckedChange={(v) => handleToggleAll(Boolean(v))}
              />
            </TableHead>
            <TableHead className={cn(HEAD, 'w-16')}>{bulkCopy.image}</TableHead>
            <TableHead className={HEAD}>{copy.variant}</TableHead>
            <TableHead className={cn(HEAD, 'w-36')}>{copy.price}</TableHead>
            <TableHead className={cn(HEAD, 'w-36')}>{copy.mrp}</TableHead>
            <TableHead className={cn(HEAD, 'w-56')}>{copy.sku}</TableHead>
            <TableHead className={cn(HEAD, 'w-28 text-center')}>{copy.available}</TableHead>
            <TableHead className={cn(HEAD, 'w-24')}>
              <span className="sr-only">{variantsCopy.edit}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((v, i) => {
            const title = variantTitle(v.optionValues)
            return (
              <TableRow key={rowKey(v)} className="border-0 hover:bg-transparent">
                <TableCell className={CELL}>
                  <Checkbox
                    aria-label={bulkCopy.selectOne(title)}
                    checked={selected.includes(i)}
                    onCheckedChange={(checked) => handleToggleRow(i, Boolean(checked))}
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <VariantImagePicker
                    media={media}
                    mediaIds={v.mediaIds}
                    label={title}
                    onChange={(mediaIds) => onVariant(i, { mediaIds })}
                    onAddMedia={onAddMedia}
                  />
                </TableCell>
                <TableCell className={cn(CELL, 'font-medium text-ink-strong')}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{title}</span>
                    {v.hiddenOnStore ? (
                      <StatusChip tone="neutral" variant="outline">
                        {variantsCopy.hidden}
                      </StatusChip>
                    ) : null}
                    {v.preorderAllowed ? null : (
                      <StatusChip tone="neutral" variant="outline">
                        {variantsCopy.noPreorder}
                      </StatusChip>
                    )}
                  </span>
                </TableCell>
                <TableCell className={CELL}>
                  <MoneyInput
                    aria-label={`${copy.price} ${title}`}
                    value={v.price}
                    onChange={(price) => onVariant(i, { price })}
                  />
                  <ZeroPriceWarning variant={v} className="mt-0.5" />
                </TableCell>
                <TableCell className={CELL}>
                  <MoneyInput
                    aria-label={`${copy.mrp} ${title}`}
                    value={v.mrp}
                    onChange={(mrp) => onVariant(i, { mrp })}
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={`${copy.sku} ${title}`}
                      value={v.sku}
                      onChange={(e) => onVariant(i, { sku: e.target.value })}
                      autoComplete="off"
                    />
                    {v.sku.trim() ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => handleGenerateSku(i)}
                        title={inventoryCopy.skuGenerateHelp}
                        aria-label={`${inventoryCopy.skuGenerate} ${copy.sku} ${title}`}
                      >
                        {inventoryCopy.skuGenerate}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className={CELL}>
                  <MoneyInput
                    aria-label={`${copy.available} ${title}`}
                    currency={false}
                    className="[&_input]:text-center"
                    value={v.quantity}
                    disabled={!v.trackInventory}
                    onChange={(quantity) => onVariant(i, { quantity })}
                  />
                </TableCell>
                <TableCell className={cn(CELL, 'text-right')}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(i)}
                    aria-label={variantsCopy.editVariant(title)}
                  >
                    <Pencil aria-hidden="true" />
                    {variantsCopy.edit}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-caption text-muted-foreground">
        <span>{footer.stockAcross(units, variants.length)}</span>
        {best ? (
          <span>
            {footer.marginOn(
              `${best.profit.pct}%`,
              fmt.money(best.profit.profitPaise),
              variantTitle(best.variant.optionValues),
            )}
          </span>
        ) : null}
      </div>
      {editing !== null ? (
        <VariantEditDialog
          key={editing}
          productTitle={productTitle}
          variants={variants}
          index={editing}
          onSave={onVariant}
          onMove={setEditing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
