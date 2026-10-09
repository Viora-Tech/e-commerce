'use client'

import { MoreHorizontal, Video } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import type { DragEvent } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'

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
  /** Native drag-and-drop wiring from the grid; absent in the library. */
  drag?:
    | {
        onDragStart: (e: DragEvent<HTMLLIElement>) => void
        onDragOver: (e: DragEvent<HTMLLIElement>) => void
        onDrop: (e: DragEvent<HTMLLIElement>) => void
        onDragEnd: () => void
        dragging: boolean
        target: boolean
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
  drag,
}: MediaTileProps) {
  // Hooks
  const { tile: copy } = useCopy(mediaContent)

  // Render logic
  const video = isVideo(item.contentType)
  const primary = actions.filter((a) => !a.destructive)
  const destructive = actions.filter((a) => a.destructive)

  return (
    <li
      draggable={drag !== undefined}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      onDragEnd={drag?.onDragEnd}
      className={cn(
        'group relative flex flex-col gap-1',
        drag && 'cursor-grab active:cursor-grabbing',
        drag?.dragging && 'opacity-40',
        cover && 'col-span-2 row-span-2',
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden border bg-muted',
          wide ? 'aspect-[4/3] rounded-xl' : 'aspect-square rounded-lg',
          drag?.target && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        {video ? (
          <video src={item.url} muted playsInline className="size-full object-cover" />
        ) : (
          // biome-ignore lint/performance/noImgElement: thumbnails from arbitrary storage hosts.
          <img src={item.url} alt={item.alt ?? ''} className="size-full object-cover" />
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
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={copy.menu}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-card/90 text-foreground opacity-0 shadow-card transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {primary.map((a) => (
              <DropdownMenuItem key={a.label} onClick={a.onSelect} disabled={a.disabled}>
                {a.label}
              </DropdownMenuItem>
            ))}
            {destructive.length ? <DropdownMenuSeparator /> : null}
            {destructive.map((a) => (
              <DropdownMenuItem
                key={a.label}
                variant="destructive"
                onClick={a.onSelect}
                disabled={a.disabled}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
    </li>
  )
}
