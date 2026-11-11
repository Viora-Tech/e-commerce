'use client'

import { variantTitle } from '@commerce/core/catalog'
import { Pencil } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import MoneyInput from '@/components/fields/money-input'
import StatusChip from '@/components/layout/status-chip'
import { productFormContent } from '@/data/product-form'
import { variantBoxContent } from '@/data/variant-box'
import { useCopy } from '@/hooks/use-copy'
import type { MediaItem, VariantRow } from './form-state'
import VariantImagePicker from './variant-image-picker'
import ZeroPriceWarning from './zero-price-warning'

type VariantMatrixRowProps = {
  variant: VariantRow
  media: MediaItem[]
  /** Drawn under a group row: indented, the grouped value still in the title. */
  nested: boolean
  selected: boolean
  onSelect: (checked: boolean) => void
  onChange: (patch: Partial<VariantRow>) => void
  onEdit: () => void
  /** Files uploaded from a variant's images dialog join the product gallery. */
  onAddMedia: (items: MediaItem[]) => void
}

/** Same grid as ResourceTable's body: rows on lighter hairlines. */
const CELL = 'border-b border-line px-3 py-2 text-body first:pl-5 last:pr-5'

/** One variant of the matrix, edited in place: price, MRP, SKU and stock. */
export default function VariantMatrixRow({
  variant: v,
  media,
  nested,
  selected,
  onSelect,
  onChange,
  onEdit,
  onAddMedia,
}: VariantMatrixRowProps) {
  // Hooks
  const {
    variants: { columns: copy, ...variantsCopy },
    variantBulk: bulkCopy,
    inventory: inventoryCopy,
  } = useCopy(productFormContent)
  const boxCopy = useCopy(variantBoxContent)

  // Render logic
  const title = variantTitle(v.optionValues)

  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell className={CELL}>
        <Checkbox
          aria-label={bulkCopy.selectOne(title)}
          checked={selected}
          onCheckedChange={(checked) => onSelect(Boolean(checked))}
        />
      </TableCell>
      <TableCell className={cn(CELL, nested && 'pl-8')}>
        <VariantImagePicker
          media={media}
          mediaIds={v.mediaIds}
          label={title}
          onChange={(mediaIds) => onChange({ mediaIds })}
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
          {/* A variant that ships in its own box, not the product's package (#1517). */}
          {v.boxOwn && v.requiresShipping ? (
            <StatusChip tone="neutral" variant="outline">
              {boxCopy.chip}
            </StatusChip>
          ) : null}
        </span>
      </TableCell>
      <TableCell className={CELL}>
        <MoneyInput
          aria-label={`${copy.price} ${title}`}
          value={v.price}
          onChange={(price) => onChange({ price })}
        />
        <ZeroPriceWarning variant={v} className="mt-0.5" />
      </TableCell>
      <TableCell className={CELL}>
        <MoneyInput
          aria-label={`${copy.mrp} ${title}`}
          value={v.mrp}
          onChange={(mrp) => onChange({ mrp })}
        />
      </TableCell>
      <TableCell className={CELL}>
        <Input
          aria-label={`${copy.sku} ${title}`}
          placeholder={inventoryCopy.skuGenerate}
          title={inventoryCopy.skuGenerateHelp}
          value={v.sku}
          onChange={(e) => onChange({ sku: e.target.value })}
          autoComplete="off"
        />
      </TableCell>
      <TableCell className={CELL}>
        <MoneyInput
          aria-label={`${copy.available} ${title}`}
          currency={false}
          className="[&_input]:text-center"
          value={v.quantity}
          disabled={!v.trackInventory}
          onChange={(quantity) => onChange({ quantity })}
        />
      </TableCell>
      <TableCell className={cn(CELL, 'text-right')}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={variantsCopy.editVariant(title)}
          title={variantsCopy.edit}
        >
          <Pencil aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
