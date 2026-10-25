/**
 * Sizing for the renderer's opt-in sprite dots (`GlobeFrame.spriteDots`): cobe's evenly spread
 * Fibonacci dots, drawn as round anti-aliased sprites. cobe draws a fixed 32k dots, which is
 * fine on a small card but leaves big gaps on a full-screen globe, so this picks the dot count
 * from the globe's size at zoom 1 (snapped to a short ladder, so a resize does not reshuffle
 * the dots every frame) and the dot radius from the spacing that gives. The count stays put
 * while zooming; the dots spread apart and grow with the globe, as on cobe.
 */

/** The renderer's Fibonacci lookup stays precise up to here (`globe-renderer.ts`). */
export const MAX_SPRITE_DOT_SAMPLES = 131071

/** Dot counts the layout snaps to: cobe's 16k and 32k, then denser steps for big globes. */
const SAMPLE_STEPS = [16000, 24000, 32000, 48000, 64000, 90000, 120000] as const

/** Centre-to-centre spacing of neighbouring dots, on a Fibonacci sphere of `samples` points,
 * as a share of the radius (hexagonal packing: each dot owns `(√3/2)·s²` of the `4π` surface). */
export function spriteDotSpacing(samples: number): number {
  return Math.sqrt((8 * Math.PI) / (Math.sqrt(3) * Math.max(samples, 1)))
}

/**
 * The dot count for a globe of `radiusCssPx` at zoom 1 whose neighbouring dots sit about
 * `spacingCssPx` apart on screen, snapped down to a step (never below the first one).
 */
export function pickSpriteDotSamples(radiusCssPx: number, spacingCssPx: number): number {
  const r = Math.max(radiusCssPx, 1)
  const s = Math.max(spacingCssPx, 0.5)
  const wanted = (8 * Math.PI * r * r) / (Math.sqrt(3) * s * s)
  let samples: number = SAMPLE_STEPS[0]
  for (const step of SAMPLE_STEPS) {
    if (step <= wanted) samples = step
  }
  return Math.min(samples, MAX_SPRITE_DOT_SAMPLES)
}

/** A dot's radius, device px: `fill` of the on-screen spacing (cobe's dots are about 0.38),
 * never under `minPx` so the smallest still read as dots rather than noise. */
export function spriteDotRadiusPx(
  samples: number,
  radiusDevicePx: number,
  fill: number,
  minPx = 0.75,
): number {
  return Math.max(minPx, fill * spriteDotSpacing(samples) * radiusDevicePx)
}
