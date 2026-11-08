'use client'

import { ChevronRight, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useState } from 'react'
import ProductThumb from '@/components/products/product-thumb'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'
import { type ProfileProductRow as Row, tickable } from './profile-products-state'

type ProfileProductRowProps = {
  row: Row
  disabled: boolean
  onTick: (variantId: string, on: boolean) => void
  onRemove: () => void
}

/** "Default" is how a product without options names its only variant. */
const named = (title: string) => (title === 'Default' || title === 'Default Title' ? '' : title)

/**
 * One product on a shipping profile's page: how many of its variants ship with this profile,
 * and, opened, a tick per variant (Shopify's product and variant picker, in place).
 */
export default function ProfileProductRow({
  row,
  disabled,
  onTick,
  onRemove,
}: ProfileProductRowProps) {
  // Hooks
  const { profile: copy } = useCopy(shippingRatesContent)
  const [open, setOpen] = useState(false)

  // Render logic
  const ships = tickable(row)
  const ticked = ships.filter((v) => row.ticked.includes(v.id)).length
  const several = row.variants.length > 1
  const summary =
    ships.length === 0
      ? copy.products.noShipping
      : !several
        ? null
        : ticked === ships.length
          ? copy.products.allVariants
          : copy.products.someVariants(ticked, ships.length)

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 px-3 py-2">
        {several ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-label={copy.products.showVariants(row.title)}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronRight className={cn('transition-transform', open && 'rotate-90')} />
          </Button>
        ) : null}
        <ProductThumb url={row.imageUrl} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-strong">{row.title}</span>
          {summary ? <span className="truncate text-caption">{summary}</span> : null}
        </span>
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copy.products.remove(row.title)}
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>
      {several && open ? (
        <ul className="flex flex-col border-border border-t bg-muted/30">
          {row.variants.map((v) => {
            const on = row.ticked.includes(v.id)
            const note = !v.requiresShipping
              ? copy.products.noShipping
              : !on && v.shipsUnder
                ? copy.products.shipsUnder(v.shipsUnder.name)
                : null
            const title = named(v.title) || row.title
            const id = `profile-variant-${v.id}`
            return (
              <li key={v.id} className="flex items-center gap-3 py-2 pr-3 pl-12">
                <Checkbox
                  id={id}
                  checked={v.requiresShipping && on}
                  disabled={disabled || !v.requiresShipping}
                  aria-label={copy.products.pickVariant(title)}
                  onCheckedChange={(next) => onTick(v.id, next === true)}
                />
                <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{title}</span>
                  {v.sku ? <span className="truncate text-caption">{v.sku}</span> : null}
                </label>
                {note ? (
                  <span className="shrink-0 text-caption text-muted-foreground">{note}</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}
