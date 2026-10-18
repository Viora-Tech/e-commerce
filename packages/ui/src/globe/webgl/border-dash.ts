/**
 * The "Border style: Dashed" maths, kept here in plain TS purely so it has a unit test — the
 * actual drawing happens in the shader (`globe-renderer.ts`'s `POINT_FS`), which discards most
 * of `borders.bin`'s dense points per frame so the ones left over read as a dashed line. This
 * function mirrors that shader's `if (phase > 0.55) discard;` line exactly; if one changes, so
 * should the other.
 *
 * Multiplying a point's distance along its border (`arcLengthRadians`, real-world distance /
 * Earth's radius) by the globe's current on-screen radius turns it into a screen distance, so
 * the dash pattern's period stays the same length in screen pixels at any zoom level, without
 * ever rebuilding the point buffer.
 */

/** A dash-plus-gap's length on screen, device px. */
export const DASH_PERIOD_CSS_PX = 5

/** How much of one period is "on" (drawn) rather than "off" (the gap). */
export const DASH_DUTY_CYCLE = 0.55

/** True when a border point at `arcLengthRadians` along its run falls in the "on" part of the
 * dash pattern, given the globe's current on-screen `radiusPx` and `dashPeriodPx` (both in the
 * same pixel unit — the renderer always uses device px for both). */
export function isDashVisible(
  arcLengthRadians: number,
  radiusPx: number,
  dashPeriodPx: number = DASH_PERIOD_CSS_PX,
): boolean {
  const screenDistance = arcLengthRadians * radiusPx
  const phase = screenDistance / dashPeriodPx - Math.floor(screenDistance / dashPeriodPx)
  return phase <= DASH_DUTY_CYCLE
}
