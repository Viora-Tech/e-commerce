/**
 * Row/dot sizing for the Live view globe's "Dotted" look. Land is drawn straight from the
 * shader (see `globe-renderer.ts`) as dots laid out in even rows of latitude — rows evenly
 * spaced, each row holding as many evenly spaced dots as fit around it, alternate rows offset
 * by half a step (no Fibonacci spiral: it moirés at a few pixels of spacing; no random jitter:
 * it reads as static). This module only picks how many rows to use and how big a dot is, from
 * the globe's on-screen size, so the two stay in sync as it is zoomed.
 */

/** Row spacing we aim for on screen, in CSS pixels (the task's "≥ 6 CSS px"). */
export const TARGET_ROW_SPACING_CSS_PX = 6

/**
 * Row counts the dotted look snaps to. A smoothly changing row count would pop dots in and
 * out every frame while zooming; snapping to a short ladder of steps keeps it stable, the way
 * the old dot renderer picked a fixed "level of detail" (see the fix/globe-moire history).
 */
const ROW_STEPS = [10, 14, 20, 28, 40, 56, 78, 108, 150, 208, 288] as const

/**
 * How many rows of latitude fit the sphere at `radiusDevicePx` while keeping the target
 * spacing, snapped down to the nearest step. `dpr` converts the device-pixel radius back to
 * CSS pixels for the spacing check.
 */
export function pickDotRows(radiusDevicePx: number, dpr: number): number {
  const cssRadius = Math.max(1, radiusDevicePx / Math.max(dpr, 1e-6))
  const maxRows = Math.floor((Math.PI * cssRadius) / TARGET_ROW_SPACING_CSS_PX)
  let rows: number = ROW_STEPS[0]
  for (const step of ROW_STEPS) {
    if (step <= maxRows) rows = step
  }
  return rows
}

/** A dot's on-screen radius fills this share of the spacing between row centres, so
 * neighbouring dots read as separate but the pattern still looks like solid coastline up
 * close. */
const DOT_FILL = 0.55

/** Never smaller than this many device pixels across (the task's "dots ≥ 3 px"). */
const MIN_DOT_DIAMETER_DEVICE_PX = 3

/** A dot's on-screen radius, in device pixels, for `rows` rows at `radiusDevicePx`. */
export function dotRadiusPx(rows: number, radiusDevicePx: number, dpr: number): number {
  const spacing = (Math.PI * radiusDevicePx) / Math.max(rows, 1)
  return Math.max((MIN_DOT_DIAMETER_DEVICE_PX * dpr) / 2, DOT_FILL * spacing * 0.5)
}
