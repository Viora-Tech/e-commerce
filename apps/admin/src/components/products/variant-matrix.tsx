'use client'

import { variantTitle } from '@commerce/core/catalog'
import { cn } from '@commerce/ui/lib/utils'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@commerce/ui/shadcn/table'
import { productFormContent } from '@/data/product-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { bestMargin } from '@/lib/variant-margin'
import type { MediaItem, VariantRow } from './form-state'
import VariantGroupRow from './variant-group-row'
import { type MatrixLine, shownIndexes } from './variant-groups'
import VariantMatrixRow from './variant-matrix-row'

type VariantMatrixProps = {
  /** Null before the product's first save: no variant has a page yet. */
  productId: string | null
  variants: VariantRow[]
  /** What to draw: variant rows, flat or under group rows (`matrixLines`). */
  lines: MatrixLine[]
  media: MediaItem[]
  selected: number[]
  onSelectedChange: (next: number[]) => void
  onToggleGroup: (value: string) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
  /** Files uploaded from a variant's images dialog join the product gallery. */
  onAddMedia: (items: MediaItem[]) => void
}

/** Same grid as ResourceTable: white 40px header on a hairline, rows on lighter hairlines. */
const HEAD =
  'h-10 border-b border-border bg-muted px-3 text-table-head text-muted-foreground first:pl-5 last:pr-5'

/** Columns of the table, for a group row's summary cell to span. */
const COLUMNS = 8

const rowKey = (v: VariantRow | undefined, index: number) =>
  v?.id ?? (v ? variantTitle(v.optionValues) : `row-${index}`)

/**
 * One row per option combination, edited in place: price, MRP, SKU and stock, optionally under
 * one summary row per value of a grouped option. Rows are selectable for bulk edits; a row's title
 * or pencil opens the variant's own page (Products › product › variant) for the rest.
 */
export default function VariantMatrix({
  productId,
  variants,
  lines,
  media,
  selected,
  onSelectedChange,
  onToggleGroup,
  onVariant,
  onAddMedia,
}: VariantMatrixProps) {
  // Hooks
  const {
    variants: { columns: copy, footer, ...variantsCopy },
    variantBulk: bulkCopy,
  } = useCopy(productFormContent)
  const fmt = useFormat()

  // Event handlers
  const handleSelectMany = (indexes: number[], checked: boolean) => {
    const rest = selected.filter((i) => !indexes.includes(i))
    onSelectedChange(checked ? [...rest, ...indexes] : rest)
  }

  // Render logic
  const shown = shownIndexes(lines)
  const allSelected = shown.length > 0 && shown.every((i) => selected.includes(i))
  const best = bestMargin(variants)

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[44rem] border-separate border-spacing-0">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD, 'w-10')}>
              <Checkbox
                aria-label={bulkCopy.selectAll}
                checked={allSelected}
                onCheckedChange={(v) => handleSelectMany(shown, Boolean(v))}
              />
            </TableHead>
            <TableHead className={cn(HEAD, 'w-16')}>{bulkCopy.image}</TableHead>
            <TableHead className={HEAD}>{copy.variant}</TableHead>
            <TableHead className={cn(HEAD, 'w-36')}>{copy.price}</TableHead>
            <TableHead className={cn(HEAD, 'w-36')}>{copy.mrp}</TableHead>
            <TableHead className={cn(HEAD, 'w-44')}>{copy.sku}</TableHead>
            <TableHead className={cn(HEAD, 'w-28 text-center')}>{copy.available}</TableHead>
            <TableHead className={cn(HEAD, 'w-12')}>
              <span className="sr-only">{variantsCopy.edit}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            if (line.kind === 'group') {
              return (
                <VariantGroupRow
                  key={`group-${line.group.value}`}
                  group={line.group}
                  open={line.open}
                  columns={COLUMNS}
                  selectedCount={line.group.indexes.filter((i) => selected.includes(i)).length}
                  onToggle={() => onToggleGroup(line.group.value)}
                  onSelect={(checked) => handleSelectMany(line.group.indexes, checked)}
                />
              )
            }
            const v = variants[line.index]
            if (!v) return null
            return (
              <VariantMatrixRow
                key={rowKey(v, line.index)}
                variant={v}
                media={media}
                nested={line.nested}
                selected={selected.includes(line.index)}
                onSelect={(checked) => handleSelectMany([line.index], checked)}
                onChange={(patch) => onVariant(line.index, patch)}
                href={productId && v.id ? routes.products.variant(productId, v.id) : null}
                onAddMedia={onAddMedia}
              />
            )
          })}
        </TableBody>
      </Table>
      {lines.length === 0 ? (
        <p className="px-5 py-6 text-center text-body text-muted-foreground">
          {variantsCopy.noMatches}
        </p>
      ) : null}
      {best ? (
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 text-caption text-muted-foreground">
          <span>
            {footer.marginOn(
              `${best.profit.pct}%`,
              fmt.money(best.profit.profitPaise),
              variantTitle(best.variant.optionValues),
            )}
          </span>
        </div>
      ) : null}
    </div>
  )
}
