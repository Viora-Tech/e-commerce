'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import ProductThumb from '@/components/products/product-thumb'
import type { PickItem } from './resource-pick-types'

type ResourcePickRowProps = {
  item: PickItem
  checked: boolean
  onToggle: (item: PickItem, on: boolean) => void
}

/** One tickable row in the Browse picker: checkbox, thumbnail, title and sub-line, meta. */
export default function ResourcePickRow({ item, checked, onToggle }: ResourcePickRowProps) {
  // Render logic
  const id = `pick-${item.id}`
  const thumb = item.thumb ?? 'image'

  return (
    <li>
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 transition-[background-color] hover:bg-muted',
          checked && 'bg-primary-soft',
        )}
      >
        <Checkbox id={id} checked={checked} onCheckedChange={(v) => onToggle(item, Boolean(v))} />
        {thumb === 'image' ? <ProductThumb url={item.imageUrl ?? null} /> : null}
        {thumb === 'initial' ? (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-foreground uppercase"
          >
            {item.title.trim().charAt(0) || '?'}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-strong">{item.title}</span>
          {item.subtitle ? (
            <span className="truncate text-caption text-muted-foreground">{item.subtitle}</span>
          ) : null}
        </span>
        {item.meta ? (
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {item.meta}
          </span>
        ) : null}
      </label>
    </li>
  )
}
