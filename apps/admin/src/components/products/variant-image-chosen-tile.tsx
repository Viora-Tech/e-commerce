'use client'

import { ArrowLeft, ArrowRight, XIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { MediaItem } from './form-state'

type VariantImageChosenTileProps = {
  item: MediaItem
  /** Zero-based place in the variant's list; 0 is the main image. */
  index: number
  total: number
  onMove: (step: -1 | 1) => void
  onRemove: () => void
}

/** One of the variant's chosen images: its place, Main on the first, move earlier/later, remove. */
export default function VariantImageChosenTile({
  item,
  index,
  total,
  onMove,
  onRemove,
}: VariantImageChosenTileProps) {
  // Hooks
  const { variantImages: copy } = useCopy(productFormContent)

  // Render logic
  const name = item.alt || copy.imageName(index + 1)

  return (
    <li className="flex flex-col gap-1.5">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
        {/* biome-ignore lint/performance/noImgElement: media comes from arbitrary storage hosts. */}
        <img src={item.url} alt={item.alt ?? ''} className="size-full object-cover" />
        <span className="absolute top-1.5 left-1.5 rounded-md bg-card/95 px-1.5 py-0.5 text-caption font-medium tabular-nums text-foreground shadow-card">
          {index === 0 ? copy.main : index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={copy.remove(name)}
          title={copy.remove(name)}
          className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-card/95 text-muted-foreground shadow-card transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3" aria-hidden />
        </button>
      </div>
      <div className="flex justify-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={copy.moveUp(name)}
          title={copy.moveUp(name)}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={copy.moveDown(name)}
          title={copy.moveDown(name)}
        >
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </li>
  )
}
