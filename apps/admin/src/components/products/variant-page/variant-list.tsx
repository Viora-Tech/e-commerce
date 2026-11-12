'use client'

import { variantTitle } from '@commerce/core/catalog'
import { cn } from '@commerce/ui/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { rupees } from '@/data/products'
import { variantPageContent } from '@/data/variant-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { MediaItem, VariantRow } from '../form-state'
import ProductThumb from '../product-thumb'
import { chosenItems } from '../variant-images'

type VariantListProps = {
  productId: string
  /** Saved variants only: each one has a page. */
  variants: VariantRow[]
  media: MediaItem[]
  currentId: string
  /** The phone picker's choice; the page asks first when there are unsaved edits. */
  onPick: (variantId: string) => void
}

/**
 * Every variant of the product beside the one being edited (Shopify's variant page): a list on
 * desktop, a picker above the cards on a phone. Links go through the save bar's leave guard.
 */
export default function VariantList({
  productId,
  variants,
  media,
  currentId,
  onPick,
}: VariantListProps) {
  // Hooks
  const copy = useCopy(variantPageContent)
  const fmt = useFormat()

  // Helpers
  const line = (v: VariantRow) => {
    const paise = rupees.toPaise(v.price)
    const price = paise == null ? copy.noPrice : fmt.money(paise)
    const stock = v.trackInventory
      ? copy.list.stock(fmt.number(Number(v.quantity) || 0))
      : copy.list.notTracked
    return `${price} · ${stock}`
  }

  // Render logic
  const saved = variants.filter((v): v is VariantRow & { id: string } => Boolean(v.id))
  const items = Object.fromEntries(saved.map((v) => [v.id, variantTitle(v.optionValues)]))

  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="variant-pick" className="sr-only">
          {copy.list.pick}
        </label>
        <Select items={items} value={currentId} onValueChange={(next) => onPick(String(next))}>
          <SelectTrigger size="lg" id="variant-pick" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {saved.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {variantTitle(v.optionValues)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden lg:block">
        <DataCard title={copy.list.heading} count={saved.length} flush>
          <nav aria-label={copy.list.heading}>
            <ul className="flex flex-col">
              {saved.map((v) => {
                const current = v.id === currentId
                const title = variantTitle(v.optionValues)
                return (
                  <li key={v.id}>
                    <Link
                      href={routes.products.variant(productId, v.id)}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 border-line border-b px-4 py-2.5 text-body transition-[background-color] hover:bg-muted/60',
                        current && 'bg-muted',
                      )}
                    >
                      <ProductThumb
                        url={chosenItems(v.mediaIds, media)[0]?.url ?? null}
                        alt=""
                        className="size-10 [&_img]:size-9"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            'truncate text-ink-strong',
                            current ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {title}
                        </span>
                        <span className="truncate text-caption text-muted-foreground tabular-nums">
                          {line(v)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </DataCard>
      </div>
    </>
  )
}
