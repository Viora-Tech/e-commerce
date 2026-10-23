'use client'

import { RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Progress } from '@commerce/ui/shadcn/progress'
import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable'
import { useId } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { useImageDnd, useLiveOrder } from '@/hooks/use-image-dnd'
import ImageDragOverlay from './image-drag-overlay'
import MediaSortableTile from './media-sortable-tile'
import type { MediaTileItem } from './media-tile'
import type { PendingUpload } from './use-upload-queue'

type MediaGridProps = {
  items: MediaTileItem[]
  pending: PendingUpload[]
  onReorder: (items: MediaTileItem[]) => void
  onEditAlt: (item: MediaTileItem) => void
  onRemove: (item: MediaTileItem) => void
  onRetry: (key: string) => void
  onDismiss: (key: string) => void
}

/* dnd-kit moves nothing itself: the grid reorders a preview live and Motion glides the tiles. */
const holdStill: SortingStrategy = () => null

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [taken] = next.splice(from, 1)
  if (taken === undefined) return list
  next.splice(to, 0, taken)
  return next
}

/**
 * Product gallery: cover first and twice the size, the rest in a grid.
 * Reorder by dragging (mouse, touch or keyboard, shared feel with the product gallery) or
 * through the tile menu.
 */
export default function MediaGrid({
  items,
  pending,
  onReorder,
  onEditAlt,
  onRemove,
  onRetry,
  onDismiss,
}: MediaGridProps) {
  // Hooks
  const { tile: copy } = useCopy(mediaContent)
  const { reduced, sensors, dropAnimation } = useImageDnd()
  const dndId = useId()
  const { shown, active, handlers } = useLiveOrder(items, (ids) =>
    onReorder(ids.flatMap((id) => items.filter((i) => i.id === id))),
  )

  // Helpers
  const actionsFor = (item: MediaTileItem, index: number) => [
    {
      label: copy.setCover,
      onSelect: () => onReorder(move(items, index, 0)),
      disabled: index === 0,
    },
    {
      label: copy.moveLeft,
      onSelect: () => onReorder(move(items, index, index - 1)),
      disabled: index === 0,
    },
    {
      label: copy.moveRight,
      onSelect: () => onReorder(move(items, index, index + 1)),
      disabled: index === items.length - 1,
    },
    { label: copy.editAlt, onSelect: () => onEditAlt(item) },
    { label: copy.remove, onSelect: () => onRemove(item), destructive: true },
  ]

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} {...handlers}>
      <SortableContext items={shown.map((i) => i.id)} strategy={holdStill}>
        <ul className="grid grid-cols-4 gap-2 md:grid-cols-6">
          {shown.map((item, index) => (
            <MediaSortableTile
              key={item.id}
              item={item}
              cover={index === 0}
              reduced={reduced}
              actions={actionsFor(item, index)}
            />
          ))}
          {pending.map((p) => (
            <li
              key={p.key}
              className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-lg border bg-muted"
            >
              {/* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */}
              <img
                src={p.previewUrl}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-60"
              />
              {p.error ? (
                <div className="relative flex flex-col items-center gap-1 bg-card/90 p-2 text-center">
                  <span className="text-caption text-destructive">{copy.failed}</span>
                  <div className="flex gap-1">
                    <Button size="xs" variant="outline" onClick={() => onRetry(p.key)}>
                      <RotateCcw aria-hidden="true" />
                      {copy.retry}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onDismiss(p.key)}>
                      ×
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative p-2">
                  <Progress value={Math.round(p.progress * 100)} className="w-full" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </SortableContext>
      <ImageDragOverlay reduced={reduced} dropAnimation={dropAnimation}>
        {active ? (
          // biome-ignore lint/performance/noImgElement: thumbnails from arbitrary storage hosts.
          <img src={active.url} alt="" draggable={false} className="size-full object-cover" />
        ) : null}
      </ImageDragOverlay>
    </DndContext>
  )
}
