import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import ProductThumb from '@/components/products/product-thumb'
import { selectProductsContent as copy } from '@/data/select-products'
import { useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import SelectProductsCheckbox from './select-products-checkbox'

export type PickRow = Awaited<ReturnType<typeof api.products.pick>>[number]

type SelectProductsRowProps = {
  row: PickRow
  /** Variant ids picked for this product. */
  picked: ReadonlySet<string>
  /** The whole product is already in the destination: shown ticked and locked. */
  added: boolean
  onToggleProduct: (row: PickRow, on: boolean) => void
  onToggleVariant: (row: PickRow, variantId: string, on: boolean) => void
}

const ROW =
  'flex w-full items-center gap-3 border-line border-b px-4 py-2.5 text-left transition-colors'

function priceText(
  min: number | null,
  max: number | null,
  money: (paise: number) => string,
): string {
  if (min === null || max === null) return ''
  return min === max ? money(min) : `${money(min)} – ${money(max)}`
}

export default function SelectProductsRow({
  row,
  picked,
  added,
  onToggleProduct,
  onToggleVariant,
}: SelectProductsRowProps) {
  // Hooks
  const fmt = useFormat()
  const [open, setOpen] = useState(false)

  // Render logic
  const multi = row.variants.length > 1
  const all = row.variants.length > 0 && picked.size === row.variants.length
  const some = picked.size > 0 && !all
  const checked = added || all
  const stock = row.available > 0 ? copy.inStock(row.available) : copy.outOfStock
  const subtitle = [
    copy.variantCount(row.variants.length),
    row.sku,
    added ? copy.alreadyAdded : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={cn(added && 'opacity-60')}>
      <div className={cn(ROW, checked || some ? 'bg-primary-soft' : 'hover:bg-muted/40')}>
        <SelectProductsCheckbox
          label={row.title}
          checked={checked}
          indeterminate={some}
          disabled={added}
          onChange={(on) => onToggleProduct(row, on)}
        />
        <ProductThumb url={row.imageUrl} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body text-foreground">{row.title}</span>
          <span className="truncate text-caption text-muted-foreground">{subtitle}</span>
        </span>
        <span
          className={cn(
            'shrink-0 text-caption',
            row.available > 0 ? 'text-muted-foreground' : 'text-danger',
          )}
        >
          {stock}
        </span>
        <span className="w-32 shrink-0 text-right text-body font-medium text-foreground tabular-nums">
          {priceText(row.pricePaiseMin, row.pricePaiseMax, fmt.money)}
        </span>
        {multi ? (
          <button
            type="button"
            aria-label={open ? copy.collapse : copy.expand}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn('size-4 transition-transform duration-150', open && 'rotate-90')}
              aria-hidden
            />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
      </div>
      {multi && open ? (
        <ul className="bg-muted/30">
          {row.variants.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 border-line border-b py-2 pr-4 pl-14 text-caption"
            >
              <SelectProductsCheckbox
                label={v.title}
                checked={added || picked.has(v.id)}
                disabled={added}
                onChange={(on) => onToggleVariant(row, v.id, on)}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">{v.title}</span>
              <span className="text-muted-foreground">{v.sku}</span>
              <span className="text-muted-foreground">
                {v.available > 0 ? copy.inStock(v.available) : copy.outOfStock}
              </span>
              <span className="w-32 text-right text-foreground tabular-nums">
                {v.pricePaise == null ? copy.noPrice : fmt.money(v.pricePaise)}
              </span>
              <span className="size-6 shrink-0" />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
