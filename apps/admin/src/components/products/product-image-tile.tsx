'use client'

import { Pencil, RefreshCw, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { DragHandle, ROW_STATE_CLASS } from '@commerce/ui/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { AnimatePresence, motion } from 'motion/react'
import type { MediaTileItem } from '@/components/media/media-tile'
import { imageEditorContent } from '@/data/image-editor'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import { IMAGE_ENTER_MS, IMAGE_GLIDE_SPRING } from '@/hooks/use-image-dnd'

type ProductImageTileProps = {
  item: MediaTileItem
  /** First in the gallery: drawn two by two, labelled "Main image", with Replace. */
  main: boolean
  reduced: boolean
  onEdit: () => void
  /** Opens the image editor (crop, rotate, adjust); left out for videos. */
  onEditImage?: (() => void) | undefined
  onRemove: () => void
  onReplace: () => void
}

/* The shared sortable easing (cubic-bezier(0.25, 1, 0.5, 1)) as a Motion curve. */
const EASE = [0.25, 1, 0.5, 1] as const
const LAYOUT = { layout: IMAGE_GLIDE_SPRING }

const BADGE_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: 0.16, ease: EASE },
} as const

/** What screen readers and the handle call an image: its alt text, else its file name. */
export function imageName(item: MediaTileItem): string {
  return item.alt || item.url.split('/').pop()?.split('?')[0] || item.id
}

/**
 * One image in the product gallery, sortable with @dnd-kit (MIT). The whole tile drags by
 * mouse or touch; the grip is the keyboard handle (space, arrows, space). dnd-kit moves
 * nothing itself (the main image is twice the size, so its strategies would overlap): the
 * card reorders a preview as the image passes over tiles and Motion glides each tile on a
 * spring (`useImageDnd`). The carried image's own slot is a dashed outline, its landing place.
 */
export default function ProductImageTile({
  item,
  main,
  reduced,
  onEdit,
  onEditImage,
  onRemove,
  onReplace,
}: ProductImageTileProps) {
  // Hooks
  const { media: copy } = useCopy(productFormContent)
  const { open: editImage } = useCopy(imageEditorContent)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id: item.id,
  })

  // Render logic
  const name = imageName(item)
  /* Pointer sensors on the whole tile; the keyboard sensor only on the grip, so space or
     enter on the tile's own buttons never picks the image up. */
  const { onKeyDown: _keys, ...pointer } = listeners ?? {}

  return (
    <motion.li
      ref={setNodeRef}
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: IMAGE_ENTER_MS / 1000, ease: EASE, ...LAYOUT }}
      {...pointer}
      className={cn(
        'group/tile relative aspect-square touch-manipulation overflow-hidden rounded-lg border border-border bg-media-tile',
        main && 'col-span-2 row-span-2',
        isDragging ? ROW_STATE_CLASS.placeholder : 'cursor-grab',
      )}
    >
      <div className="size-full">
        <button
          type="button"
          onClick={onEdit}
          className="size-full focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
          aria-label={copy.editAlt(name)}
        >
          {/* biome-ignore lint/performance/noImgElement: media comes from arbitrary storage hosts. */}
          <img
            src={item.url}
            alt=""
            draggable={false}
            className={cn('size-full', main ? 'object-contain' : 'object-cover')}
          />
        </button>
      </div>
      <DragHandle
        ref={setActivatorNodeRef}
        label={copy.sort.handle(name)}
        {...attributes}
        {...listeners}
        className="absolute top-1.5 left-1.5 size-7 border border-border bg-card/95 shadow-card transition-opacity duration-150 focus-visible:opacity-100 motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100"
      />
      {onEditImage ? (
        <button
          type="button"
          onClick={onEditImage}
          aria-label={editImage(name)}
          className="absolute top-1.5 right-10 flex size-7 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-card transition-[color,opacity] duration-150 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={copy.remove(name)}
        className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-card transition-[color,opacity] duration-150 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {main ? (
          <motion.span
            key="main"
            {...(reduced ? {} : BADGE_MOTION)}
            className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-card/95 px-2 py-1 text-caption font-medium text-foreground shadow-card"
          >
            {copy.main}
          </motion.span>
        ) : null}
      </AnimatePresence>
      {main ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onReplace}
          className="absolute right-2 bottom-2 bg-card/95 shadow-card hover:bg-card"
        >
          <RefreshCw aria-hidden="true" />
          {copy.replace}
        </Button>
      ) : null}
    </motion.li>
  )
}
