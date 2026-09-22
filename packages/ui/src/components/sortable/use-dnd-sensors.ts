import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { DRAG_ACTIVATION_PX, TOUCH_DELAY_MS, TOUCH_TOLERANCE_PX } from './motion'

/**
 * The sensors every sortable in the admin uses (shadcn's data-table pattern):
 * mouse after a few pixels of travel, touch after a short hold, keyboard with
 * space to pick up and arrows to move. SortableTree turns the keyboard sensor
 * off because it runs its own keyboard lift, which can also change the level.
 */
export function useDndSensors({ keyboard = true }: { keyboard?: boolean } = {}) {
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } })
  const touch = useSensor(TouchSensor, {
    activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX },
  })
  const keys = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  return useSensors(mouse, touch, keyboard ? keys : null)
}
