'use client'

import { variantTitle } from '@commerce/core/catalog'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { MoneyInput } from '@/components/fields/money-input'
import { productFormContent } from '@/data/products'
import type { VariantRow } from './form-state'

type VariantMatrixProps = {
  variants: VariantRow[]
  onVariant: (index: number, patch: Partial<VariantRow>) => void
}

const copy = productFormContent.variants.columns

/** Kit table: tinted rounded header band, hairline rows (same as ResourceTable). */
const HEAD =
  'h-12 bg-primary-soft px-4 text-table-head uppercase text-muted-foreground first:rounded-l-lg last:rounded-r-lg'
const CELL = 'border-b border-border-soft px-4 py-2 text-body'

const rowKey = (v: VariantRow) => v.id ?? variantTitle(v.optionValues)

/** One row per option combination with the fields merchants edit in bulk. */
export function VariantMatrix({ variants, onVariant }: VariantMatrixProps) {
  return (
    <div className="px-5 pb-5">
      <Table className="border-separate border-spacing-0">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
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
