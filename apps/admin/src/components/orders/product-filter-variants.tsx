'use client'

import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import ProductThumb from '@/components/products/product-thumb'
import SelectProductsCheckbox from '@/components/products/select-products-checkbox'
import type { PickRow } from '@/components/products/select-products-row'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'

type ProductFilterVariantsProps = {
  row: PickRow
  state: 'all' | 'some' | 'none'
  isPicked: (variantId: string) => boolean
  onToggleProduct: (row: PickRow, on: boolean) => void
  onToggleVariant: (row: PickRow, variantId: string, on: boolean) => void
  onBack: () => void
}

const LINE =
  'flex cursor-pointer items-center gap-2.5 border-border border-b px-3.5 py-2 transition-colors last:border-b-0'

/** One product's variants in the Orders Product filter (Shopify's ›): tick sizes one by one. */
export default function ProductFilterVariants({
  row,
  state,
  isPicked,
  onToggleProduct,
  onToggleVariant,
  onBack,
}: ProductFilterVariantsProps) {
  // Hooks
  const copy = useCopy(ordersContent).filters.picker

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 shrink-0 items-center gap-1.5 border-border border-b px-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {copy.back}
      </button>
      <div className="flex items-center gap-2.5 border-border border-b px-3.5 py-2">
        <ProductThumb url={row.imageUrl} />
        <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">
          {row.title}
        </span>
      </div>
      <ul className="flex flex-col">
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the checkbox inside handles the keyboard. */}
        <li
          onClick={() => onToggleProduct(row, state !== 'all')}
          className={cn(LINE, state === 'all' ? 'bg-primary-soft' : 'hover:bg-muted/40')}
        >
          <SelectProductsCheckbox
            label={copy.allVariants}
            checked={state === 'all'}
            indeterminate={state === 'some'}
            onChange={(on) => onToggleProduct(row, on)}
          />
          <span className="text-body text-foreground">{copy.allVariants}</span>
        </li>
        {row.variants.map((v) => {
          const on = isPicked(v.id)
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the checkbox inside handles the keyboard.
            <li
              key={v.id}
              onClick={() => onToggleVariant(row, v.id, !on)}
              className={cn(LINE, 'pl-8', on ? 'bg-primary-soft' : 'hover:bg-muted/40')}
            >
              <SelectProductsCheckbox
                label={v.title}
                checked={on}
                onChange={(next) => onToggleVariant(row, v.id, next)}
              />
              <span className="min-w-0 flex-1 truncate text-body text-foreground">{v.title}</span>
              {v.sku ? (
                <span className="shrink-0 text-caption text-muted-foreground">{v.sku}</span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
