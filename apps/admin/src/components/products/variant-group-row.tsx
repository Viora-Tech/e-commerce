'use client'

import { ChevronDown, ChevronRightIcon } from '@commerce/ui/icons'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { VariantGroup } from './variant-groups'

type VariantGroupRowProps = {
  group: VariantGroup
  open: boolean
  /** How many of the group's variants are ticked. */
  selectedCount: number
  /** Columns of the variants table, for the summary cell to span. */
  columns: number
  onToggle: () => void
  onSelect: (checked: boolean) => void
}

const CELL = 'border-b border-line bg-muted/40 px-3 py-2 text-body first:pl-5 last:pr-5'

/** "Mini · 5 variants · ₹1,299–₹1,499 · 42 in stock": one value of the grouped option, opens to its variants. */
export default function VariantGroupRow({
  group,
  open,
  selectedCount,
  columns,
  onToggle,
  onSelect,
}: VariantGroupRowProps) {
  // Hooks
  const { variantGroups: copy } = useCopy(productFormContent)
  const fmt = useFormat()

  // Render logic
  const all = selectedCount > 0 && selectedCount === group.indexes.length
  const some = selectedCount > 0 && !all
  const price =
    group.minPrice == null || group.maxPrice == null
      ? copy.noPrice
      : group.minPrice === group.maxPrice
        ? fmt.money(group.minPrice)
        : `${fmt.money(group.minPrice)}–${fmt.money(group.maxPrice)}`
  const Chevron = open ? ChevronDown : ChevronRightIcon

  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell className={CELL}>
        <Checkbox
          aria-label={copy.selectGroup(group.value)}
          checked={all}
          indeterminate={some}
          onCheckedChange={(checked) => onSelect(Boolean(checked))}
        />
      </TableCell>
      <TableCell className={CELL} colSpan={columns - 1}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <Chevron aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="font-medium text-ink-strong">{group.value || copy.blank}</span>
          <span className="text-muted-foreground">
            {` · ${copy.variants(group.indexes.length)} · ${price} · ${copy.stock(group.stock)}`}
          </span>
        </button>
      </TableCell>
    </TableRow>
  )
}
