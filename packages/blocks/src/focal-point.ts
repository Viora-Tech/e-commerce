/**
 * An image's focal point: the spot that must stay in frame when a block crops
 * the image to fill its box (`object-fit: cover`). Stored on the image value
 * next to `url` and `alt` as percentages from the top-left corner:
 *
 *   { url: '/media/a.jpg', alt: 'Red keyboard', focal: { x: 30, y: 60 } }
 *
 * `x` and `y` run 0–100 with one decimal. A missing or malformed `focal` means
 * the centre, which is what every image did before focal points existed, so
 * old theme docs render exactly as they did. Blocks apply it with
 * `focalStyle(image.focal)` (an inline `object-position`), and the editor's
 * picker sets it with `focalFromPoint` when the merchant clicks the preview.
 */
export type FocalPoint = { x: number; y: number }

export const CENTRE: FocalPoint = { x: 50, y: 50 }

const clamp = (n: number) => Math.min(100, Math.max(0, n))
const round = (n: number) => Math.round(n * 10) / 10

/** A stored focal point, or null when it's missing or not two finite numbers. */
export function normaliseFocal(value: unknown): FocalPoint | null {
  if (typeof value !== 'object' || value === null) return null
  const { x, y } = value as { x?: unknown; y?: unknown }
  if (typeof x !== 'number' || typeof y !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x: round(clamp(x)), y: round(clamp(y)) }
}

/** The CSS `object-position` for a stored focal point ("50% 50%" when there isn't one). */
export function focalToObjectPosition(value: unknown): string {
  const focal = normaliseFocal(value) ?? CENTRE
  return `${focal.x}% ${focal.y}%`
}

/** Inline style for an `<img>` that crops: undefined for the centre, so markup stays unchanged. */
export function focalStyle(value: unknown): { objectPosition: string } | undefined {
  const focal = normaliseFocal(value)
  if (!focal || (focal.x === CENTRE.x && focal.y === CENTRE.y)) return undefined
  return { objectPosition: `${focal.x}% ${focal.y}%` }
}

/** Where a click landed on the preview, as a focal point (clamped to the image's box). */
export function focalFromPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): FocalPoint {
  if (rect.width <= 0 || rect.height <= 0) return CENTRE
  return {
    x: round(clamp(((clientX - rect.left) / rect.width) * 100)),
    y: round(clamp(((clientY - rect.top) / rect.height) * 100)),
  }
}

/** Moves a focal point by whole percentage steps, for arrow-key control of the picker. */
export function nudgeFocal(value: unknown, dx: number, dy: number): FocalPoint {
  const focal = normaliseFocal(value) ?? CENTRE
  return { x: round(clamp(focal.x + dx)), y: round(clamp(focal.y + dy)) }
}
