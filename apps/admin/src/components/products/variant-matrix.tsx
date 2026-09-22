'use client'

import { variantTitle } from '@commerce/core/catalog'
import { cn } from '@commerce/ui/lib/utils'
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
import MoneyInput from '@/components/fields/money-input'
import { productFormContent } from '@/data/products'
import type { MediaItem, VariantRow } from './form-state'
import VariantImagePicker from './variant-image-picker'

type VariantMatrixProps = {
  variants: VariantRow[]
  media: MediaItem[]
  selected: number[]
  onSelectedChange: (next: number[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
}

const copy = productFormContent.variants.columns
const bulkCopy = productFormContent.variantBulk

/** Kit table: tinted rounded header band, hairline rows (same as ResourceTable). */
const HEAD =
  'h-12 bg-primary-soft px-4 text-table-head uppercase text-muted-foreground first:rounded-l-lg last:rounded-r-lg'
const CELL = 'border-b border-border-soft px-4 py-2 text-body'

const rowKey = (v: VariantRow) => v.id ?? variantTitle(v.optionValues)

/** One row per option combination, selectable so prices can be set in bulk. */
export default function VariantMatrix({
  variants,
  media,
  selected,
  onSelectedChange,
  onVariant,
}: VariantMatrixProps) {
  // Event handlers
  const handleToggleAll = (checked: boolean) => {
    onSelectedChange(checked ? variants.map((_, i) => i) : [])
  }

  const handleToggleRow = (index: number, checked: boolean) => {
    onSelectedChange(checked ? [...selected, index] : selected.filter((i) => i !== index))
  }

  // Render logic
  const allSelected = variants.length > 0 && selected.length === variants.length

  return (
    <div className="px-5 pb-5">
      <Table className="border-separate border-spacing-0">
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
            <TableHead className={cn(HEAD, 'w-40')}>{copy.sku}</TableHead>
            <TableHead className={cn(HEAD, 'w-28')}>{copy.available}</TableHead>
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
                    mediaId={v.mediaId}
                    label={title}
                    onChange={(mediaId) => onVariant(i, { mediaId })}
                  />
                </TableCell>
                <TableCell className={cn(CELL, 'font-bold text-ink-strong')}>{title}</TableCell>
                <TableCell className={CELL}>
                  <MoneyInput
                    aria-label={`${copy.price} ${title}`}
                    value={v.price}
                    onChange={(price) => onVariant(i, { price })}
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <MoneyInput
                    aria-label={`${copy.mrp} ${title}`}
                    value={v.mrp}
                    onChange={(mrp) => onVariant(i, { mrp })}
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <Input
                    aria-label={`${copy.sku} ${title}`}
                    value={v.sku}
                    onChange={(e) => onVariant(i, { sku: e.target.value })}
                    autoComplete="off"
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <MoneyInput
                    aria-label={`${copy.available} ${title}`}
                    currency={false}
                    value={v.quantity}
                    disabled={!v.trackInventory}
                    onChange={(quantity) => onVariant(i, { quantity })}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
