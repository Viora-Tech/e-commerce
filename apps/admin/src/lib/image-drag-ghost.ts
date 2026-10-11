import { IMAGE_LIFT_SCALE, IMAGE_LIFT_TILT_DEG } from '@/hooks/use-image-dnd'

/**
 * The picture that rides under the pointer during a native drag (a library tile dragged onto
 * the canvas, which a DOM drag has to be: the drop lands in another frame). Same lift as the
 * sortable overlays: slightly larger, a touch of tilt, a soft shadow. Skipped when the viewer
 * prefers reduced motion. The browser snapshots it on the next frame, so it is removed then.
 */
export function setLiftedDragImage(e: DragEvent, source: HTMLElement, reduced: boolean): void {
  if (reduced || !e.dataTransfer) return
  const { width, height } = source.getBoundingClientRect()
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    `width:${width}px`,
    `height:${height}px`,
    'pointer-events:none',
    `transform:scale(${IMAGE_LIFT_SCALE}) rotate(${IMAGE_LIFT_TILT_DEG}deg)`,
    'box-shadow:0 0.75rem 1.5rem -0.25rem rgb(0 0 0 / 0.28)',
    'border-radius:0.625rem',
  ].join(';')
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, width / 2, height / 2)
  requestAnimationFrame(() => ghost.remove())
}
