'use client'

import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import ProductThumb from '@/components/products/product-thumb'
import SelectProductsCheckbox from '@/components/products/select-products-checkbox'
import type { PickRow } from '@/components/products/select-products-row'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'

type ProductFilterRowProps = {
  row: PickRow
  state: 'all' | 'some' | 'none'
  /** The search as typed: a variant whose SKU matches is named under the title. */
  query: string
  onToggle: (row: PickRow, on: boolean) => void
  onOpen: (row: PickRow) => void
}

/** The variant a typed SKU found, so "GP-M" shows which size matched. */
function skuMatch(row: PickRow, query: string): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const v = row.variants.find((x) => x.sku?.toLowerCase().includes(q))
  return v ? [v.title, v.sku].filter(Boolean).join(' · ') : null
}

/**
 * One product in the Orders Product filter (Shopify's list): a tick box for every variant, the
 * picture and title, and › to tick single variants when it has more than one.
 */
export default function ProductFilterRow({
  row,
  state,
  query,
  onToggle,
  onOpen,
}: ProductFilterRowProps) {
  // Hooks
  const orders = useCopy(ordersContent)

  // Event handlers
  /** A click on the row does what its tick box does; the box itself stays for keyboards. */
  const handleRow = () => onToggle(row, state !== 'all')

  // Render logic
  const copy = orders.filters.picker
  const multi = row.variants.length > 1
  const subtitle =
    skuMatch(row, query) ?? (multi ? copy.variantCount(row.variants.length) : row.sku)

  return (
    <li className="flex items-center border-border border-b last:border-b-0">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a mouse shortcut; the checkbox inside is the keyboard control. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the checkbox inside handles the keyboard. */}
      <div
        onClick={handleRow}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3.5 py-2 transition-colors',
          state === 'none' ? 'hover:bg-muted/40' : 'bg-primary-soft',
        )}
      >
        <SelectProductsCheckbox
          label={row.title}
          checked={state === 'all'}
          indeterminate={state === 'some'}
          onChange={(on) => onToggle(row, on)}
        />
        <ProductThumb url={row.imageUrl} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body text-foreground">{row.title}</span>
          {subtitle ? (
            <span className="truncate text-caption text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      </div>
      {multi ? (
        <button
          type="button"
          aria-label={copy.openVariants(row.title)}
          onClick={() => onOpen(row)}
          className="mr-2 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="mr-2 size-7 shrink-0" />
      )}
    </li>
  )
}
