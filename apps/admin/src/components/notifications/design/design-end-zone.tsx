'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useDroppable } from '@dnd-kit/core'
import { END_ZONE_ID } from './design-drop'

type DesignEndZoneProps = {
  /** A palette tile is being dragged: the zone shows itself. */
  active: boolean
  label: string
}

/** The drop zone under the last block, so a new block can go in at the very end. */
export default function DesignEndZone({ active, label }: DesignEndZoneProps) {
  // Hooks
  const drop = useDroppable({ id: END_ZONE_ID })

  // Render logic
  return (
    <div
      ref={drop.setNodeRef}
      aria-hidden="true"
      className={cn(
        'flex h-10 items-center justify-center rounded-md border border-dashed text-caption text-muted-foreground transition-colors',
        active ? 'border-border' : 'border-transparent text-transparent',
        drop.isOver && 'border-primary bg-primary/5 text-foreground',
      )}
    >
      {label}
    </div>
  )
}
