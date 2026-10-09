'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Progress } from '@commerce/ui/shadcn/progress'
import { type DragEvent, useState } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import MediaTile, { type MediaTileItem } from './media-tile'
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

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [taken] = next.splice(from, 1)
  if (taken === undefined) return list
  next.splice(to, 0, taken)
  return next
}

/**
 * Product gallery: cover first and twice the size, the rest in a grid.
 * Reorder by dragging (pointer) or through the tile menu (keyboard).
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
  const [dragging, setDragging] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)

  // Helpers
  const dragFor = (index: number) => ({
    onDragStart: (e: DragEvent<HTMLLIElement>) => {
      e.dataTransfer.effectAllowed = 'move'
      setDragging(index)
    },
    onDragOver: (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault()
      if (dragging !== null && target !== index) setTarget(index)
    },
    onDrop: (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault()
      if (dragging !== null && dragging !== index) onReorder(move(items, dragging, index))
      setDragging(null)
      setTarget(null)
    },
    onDragEnd: () => {
      setDragging(null)
      setTarget(null)
    },
    dragging: dragging === index,
    target: target === index && dragging !== index,
  })

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
    <ul className="grid grid-cols-4 gap-2 md:grid-cols-6">
      {items.map((item, index) => (
        <MediaTile
          key={item.id}
          item={item}
          cover={index === 0}
          actions={actionsFor(item, index)}
          drag={dragFor(index)}
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
  )
}
