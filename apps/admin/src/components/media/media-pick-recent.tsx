'use client'

import { cn } from '@commerce/ui/lib/utils'
import { mediaContent } from '@/data/media'
import { filenameFrom, type MediaItem } from './media-pick-types'
import MediaThumb from './media-thumb'

type MediaPickRecentProps = {
  items: MediaItem[]
  selectedIds: string[]
  onToggle: (id: string) => void
  /** Double-click picks straight away, as in the grid. */
  onConfirm: (id: string) => void
}

const copy = mediaContent.picker

/** "Recently used": the files last picked in this browser, one click away above the library. */
export default function MediaPickRecent({
  items,
  selectedIds,
  onToggle,
  onConfirm,
}: MediaPickRecentProps) {
  // Early returns
  if (items.length === 0) return null

  // Render logic
  return (
    <section aria-label={copy.recent} className="flex flex-col gap-2 pb-4">
      <h3 className="text-caption font-medium text-muted-foreground">{copy.recent}</h3>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = selectedIds.includes(item.id)
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                onDoubleClick={() => {
                  onToggle(item.id)
                  onConfirm(item.id)
                }}
                aria-pressed={active}
                aria-label={item.alt || filenameFrom(item.key) || copy.title}
                className={cn(
                  'flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted p-1 motion-press focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active ? 'ring-2 ring-primary' : 'hover:shadow-card-hover',
                )}
              >
                <MediaThumb item={item} className="object-contain" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
