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

/** Same grid as ResourceTable: white 40px header on a hairline, rows on lighter hairlines. */
const HEAD =
  'h-10 border-b border-border px-3 text-table-head text-muted-foreground first:pl-5 last:pr-5'
const CELL = 'border-b border-line px-3 py-2 text-body first:pl-5 last:pr-5'

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
    <div className="overflow-x-auto">
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
                <TableCell className={cn(CELL, 'font-medium text-ink-strong')}>{title}</TableCell>
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
