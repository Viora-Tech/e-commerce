import { useDndSensors } from '@commerce/ui/sortable'
import {
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useReducedMotion } from 'motion/react'
import { useState } from 'react'

/**
 * One feel for every image drag in the admin (product gallery, media grid, theme media rail):
 * the tile lifts, neighbours glide on a spring, the drop settles without overshoot.
 * Only transform and opacity ever animate.
 */
export const IMAGE_LIFT_SCALE = 1.04
export const IMAGE_LIFT_TILT_DEG = 1.5
/** Neighbours sliding into place: critically damped, so no wobble at a row wrap. */
export const IMAGE_GLIDE_SPRING = {
  type: 'spring',
  stiffness: 520,
  damping: 44,
  mass: 0.9,
} as const
/** The lift on pick-up: a touch livelier, still no overshoot to speak of. */
export const IMAGE_LIFT_SPRING = {
  type: 'spring',
  stiffness: 600,
  damping: 34,
  mass: 0.8,
} as const
/** Uploads arriving as tiles. */
export const IMAGE_ENTER_MS = 180
export const IMAGE_DROP_MS = 240
export const IMAGE_DROP_EASING = 'cubic-bezier(0.2, 0.9, 0.25, 1)'
/** The pick-up shadow layer and the lifted frame carry these attributes so the drop can fade them. */
export const LIFT_SHADOW_ATTR = 'data-lift-shadow'
export const LIFT_FRAME_ATTR = 'data-lift-frame'

/** Settles the overlay into its slot and, in the same breath, fades the shadow and un-tilts the frame. */
function imageDropAnimation(): DropAnimation {
  const base = defaultDropAnimationSideEffects({ styles: { active: { opacity: '1' } } })
  return {
    duration: IMAGE_DROP_MS,
    easing: IMAGE_DROP_EASING,
    sideEffects: (args) => {
      const cleanup = base?.(args)
      const timing = {
        duration: IMAGE_DROP_MS,
        easing: IMAGE_DROP_EASING,
        fill: 'forwards',
      } as const
      const node = args.dragOverlay.node
      node.querySelector(`[${LIFT_SHADOW_ATTR}]`)?.animate([{ opacity: 1 }, { opacity: 0 }], timing)
      node
        .querySelector(`[${LIFT_FRAME_ATTR}]`)
        ?.animate(
          [
            { transform: `scale(${IMAGE_LIFT_SCALE}) rotate(${IMAGE_LIFT_TILT_DEG}deg)` },
            { transform: 'scale(1) rotate(0deg)' },
          ],
          timing,
        )
      return cleanup
    },
  }
}

/**
 * Sensors (mouse after a few px, touch after a short hold, keyboard), the reduced-motion flag
 * and the tuned drop animation, for any image grid that sorts with @dnd-kit.
 */
export function useImageDnd() {
  const prefersReducedMotion = useReducedMotion()
  const sensors = useDndSensors()
  const reduced = prefersReducedMotion === true
  return { reduced, sensors, dropAnimation: reduced ? null : imageDropAnimation() }
}

/** Items in the order of `ids`; anything not listed (an upload that landed mid-drag) stays at the end. */
export function inOrder<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const listed = ids.flatMap((id) => items.filter((i) => i.id === id))
  return [...listed, ...items.filter((i) => !ids.includes(i.id))]
}

/**
 * Live reordering for a grid whose tiles differ in size (a double-size cover), where dnd-kit's
 * own sorting strategies would overlap them. The carried image takes the slot of the tile it is
 * over in a preview order; Motion glides the other tiles to their new places. `commit` gets the
 * final ids on drop; cancelling drops the preview.
 */
export function useLiveOrder<T extends { id: string }>(
  items: T[],
  commit: (ids: string[]) => void,
) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [preview, setPreview] = useState<string[] | null>(null)

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setPreview(items.map((i) => i.id))
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return
    setPreview((prev) => {
      const ids = prev ?? items.map((i) => i.id)
      const from = ids.indexOf(String(active.id))
      const to = ids.indexOf(String(over.id))
      return from === -1 || to === -1 ? ids : arrayMove(ids, from, to)
    })
  }

  const handleDragEnd = () => {
    const ids = preview
    setActiveId(null)
    setPreview(null)
    if (ids) commit(ids)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setPreview(null)
  }

  return {
    shown: preview ? inOrder(items, preview) : items,
    active: activeId ? items.find((i) => i.id === activeId) : undefined,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
  }
}
