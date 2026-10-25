'use client'

import { useSortable } from '@dnd-kit/sortable'
import MediaTile, { type MediaTileAction, type MediaTileItem } from './media-tile'

type MediaSortableTileProps = {
  item: MediaTileItem
  cover: boolean
  reduced: boolean
  actions: MediaTileAction[]
}

/** A media tile wired to the surrounding @dnd-kit sortable; the grid moves it (see `useLiveOrder`). */
export default function MediaSortableTile({
  item,
  cover,
  reduced,
  actions,
}: MediaSortableTileProps) {
  // Hooks
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.id })

  return (
    <MediaTile
      item={item}
      cover={cover}
      actions={actions}
      sortable={{
        ref: setNodeRef,
        props: { ...attributes, ...listeners },
        dragging: isDragging,
        reduced,
      }}
    />
  )
}
