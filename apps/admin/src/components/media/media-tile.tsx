'use client'

import { ImageIcon, Video } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { ROW_STATE_CLASS } from '@commerce/ui/sortable'
import { motion } from 'motion/react'
import type { Ref } from 'react'
import ActionMenu from '@/components/layout/action-menu'
import FallbackImage from '@/components/layout/fallback-image'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { IMAGE_GLIDE_SPRING } from '@/hooks/use-image-dnd'

export type MediaTileItem = {
  id: string
  url: string
  alt: string | null
  contentType: string | null
}

export type MediaTileAction = {
  label: string
  onSelect: () => void
  /** Renders in the destructive colour, after a separator. */
  destructive?: boolean | undefined
  disabled?: boolean | undefined
}

type MediaTileProps = {
  item: MediaTileItem
  /** Position 0 in a gallery. */
  cover?: boolean | undefined
  /** Caption under the thumbnail (library usage count). */
  caption?: string | undefined
  /** Second caption line: type and size. */
  meta?: string | undefined
  /** Landscape thumbnail (the Files library) instead of a square. */
  wide?: boolean | undefined
  actions: MediaTileAction[]
  /** @dnd-kit wiring from the sortable grid (`MediaSortableTile`); absent in the library. */
  sortable?:
    | {
        ref: Ref<HTMLLIElement>
        props: Record<string, unknown>
        dragging: boolean
        reduced: boolean
      }
    | undefined
}

const isVideo = (contentType: string | null) => contentType?.startsWith('video/') ?? false

export default function MediaTile({
  item,
  cover,
  caption,
  meta,
  wide,
  actions,
  sortable,
}: MediaTileProps) {
  // Hooks
  const { tile: copy } = useCopy(mediaContent)

  // Render logic
  const video = isVideo(item.contentType)
  const primary = actions.filter((a) => !a.destructive)
  const destructive = actions.filter((a) => a.destructive)

  return (
    <motion.li
      ref={sortable?.ref}
      layout={sortable !== undefined && !sortable.reduced}
      transition={{ layout: IMAGE_GLIDE_SPRING }}
      {...sortable?.props}
      className={cn(
        'group relative flex flex-col gap-1',
        sortable && 'cursor-grab touch-manipulation',
        cover && 'col-span-2 row-span-2',
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden border bg-muted',
          wide ? 'aspect-[4/3] rounded-xl' : 'aspect-square rounded-lg',
          sortable?.dragging && ROW_STATE_CLASS.placeholder,
        )}
      >
        {video ? (
          <video src={item.url} muted playsInline className="size-full object-cover" />
        ) : (
          <FallbackImage
            src={item.url}
            alt={item.alt ?? ''}
            className="size-full object-cover"
            fallback={
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-6" aria-hidden />
              </span>
            }
          />
        )}
        {cover ? (
          <span className="absolute top-2 left-2 rounded-md bg-card/90 px-2 py-0.5 text-caption text-foreground shadow-card">
            {copy.cover}
          </span>
        ) : null}
        {video ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-card/90 px-2 py-0.5 text-caption text-foreground">
            <Video className="size-3" aria-hidden />
            {copy.video}
          </span>
        ) : null}
        <ActionMenu
          label={copy.menu}
          variant="bare"
          triggerClassName="absolute top-2 right-2 size-7 rounded-md bg-card/90 text-foreground opacity-0 shadow-card transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          items={[
            ...primary.map((a) => ({ label: a.label, onSelect: a.onSelect, disabled: a.disabled })),
            ...destructive.map((a) => ({
              label: a.label,
              onSelect: a.onSelect,
              disabled: a.disabled,
              destructive: true,
            })),
          ]}
        />
      </div>
      {caption ? (
        <span
          className={cn(
            'truncate text-caption',
            meta ? 'font-medium text-ink-strong' : 'text-muted-foreground',
          )}
        >
          {caption}
        </span>
      ) : null}
      {meta ? <span className="truncate text-caption text-muted-foreground">{meta}</span> : null}
    </motion.li>
  )
}
