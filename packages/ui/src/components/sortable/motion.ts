import { type DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core'

/**
 * One timing for every drag in the admin: rows gliding aside, the drop settling,
 * the overlay lifting. 200ms, easing out, off when the viewer prefers reduced motion.
 */
export const SORT_DURATION_MS = 200
export const SORT_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)'

/** Mouse travel before a press becomes a drag, so a click on the handle stays a click. */
export const DRAG_ACTIVATION_PX = 4
/** Touch holds this long before dragging, so the list still scrolls under a finger. */
export const TOUCH_DELAY_MS = 200
export const TOUCH_TOLERANCE_PX = 6

/** The useSortable transition: null when motion is reduced. */
export function sortTransition(reduced: boolean) {
  return reduced ? null : { duration: SORT_DURATION_MS, easing: SORT_EASING }
}

/** The DragOverlay drop animation: the source row stays faint until the overlay lands. */
export function dropAnimation(reduced: boolean): DropAnimation | null {
  if (reduced) return null
  return {
    duration: SORT_DURATION_MS,
    easing: SORT_EASING,
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  }
}
