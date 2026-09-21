'use client'

import { variantTitle } from '@commerce/core/catalog'
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

const rowKey = (v: VariantRow) => v.id ?? variantTitle(v.optionValues)

/** One row per option combination with the fields merchants edit in bulk. */
export function VariantMatrix({ variants, onVariant }: VariantMatrixProps) {
  return (
    <div className="border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.variant}</TableHead>
            <TableHead className="w-36">{copy.price}</TableHead>
            <TableHead className="w-36">{copy.mrp}</TableHead>
            <TableHead className="w-40">{copy.sku}</TableHead>
            <TableHead className="w-28">{copy.available}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((v, i) => {
            const title = variantTitle(v.optionValues)
            return (
              <TableRow key={rowKey(v)}>
                <TableCell className="font-medium">{title}</TableCell>
                <TableCell>
                  <MoneyInput
                    aria-label={`${copy.price} ${title}`}
                    value={v.price}
                    onChange={(price) => onVariant(i, { price })}
                  />
                </TableCell>
                <TableCell>
                  <MoneyInput
                    aria-label={`${copy.mrp} ${title}`}
                    value={v.mrp}
                    onChange={(mrp) => onVariant(i, { mrp })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${copy.sku} ${title}`}
                    value={v.sku}
                    onChange={(e) => onVariant(i, { sku: e.target.value })}
                    autoComplete="off"
                  />
                </TableCell>
                <TableCell>
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
