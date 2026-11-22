'use client'

import type { FreeBlockType } from '@commerce/notifications/design'
import { GripVertical } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useDraggable } from '@dnd-kit/core'
import { paletteDragId } from './design-drop'

type DesignPaletteTileProps = {
  type: FreeBlockType
  label: string
  disabled: boolean
  onAdd: (type: FreeBlockType) => void
}

/**
 * One block in "Add a block": drag it into the list with the mouse or a finger, or click it
 * (Enter or Space from the keyboard) to add it below the selected block. The keyboard does not
 * start a drag here, so Enter always adds.
 */
export default function DesignPaletteTile({
  type,
  label,
  disabled,
  onAdd,
}: DesignPaletteTileProps) {
  // Hooks
  const drag = useDraggable({ id: paletteDragId(type), disabled })

  // Render logic
  const { onKeyDown: _keyboardDrag, ...pointerListeners } = drag.listeners ?? {}

  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      disabled={disabled}
      onClick={() => onAdd(type)}
      {...pointerListeners}
      className={cn(
        'flex h-9 touch-none items-center gap-1.5 rounded-md border border-border bg-card px-2 text-left text-body',
        'cursor-grab hover:bg-muted active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        drag.isDragging && 'opacity-50',
      )}
    >
      <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </button>
  )
}
