/**
 * Timing for the storefront's Motion effects, ported from Zero Drift's reveal.js,
 * overlay-motion.js and hero-carousel.js. Durations are seconds (Motion's unit);
 * distances are rem so they scale with the merchant's body size.
 */

/** Scroll reveal: a short rise that settles on a soft spring, the fade on a plain ease. */
export const REVEAL = {
  riseRem: 1,
  fade: { duration: 0.5, ease: 'easeOut' },
  rise: { type: 'spring', stiffness: 170, damping: 22, mass: 1 },
  /** Start once a sliver of the section is inside the viewport, not at its very edge. */
  margin: '0px 0px -10% 0px',
} as const

/** Mobile menu drawer: expo-out in, quicker out, same curve as the cart drawer. */
export const DRAWER = {
  in: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
  out: { duration: 0.28, ease: [0.7, 0, 0.84, 0] },
  scrim: { duration: 0.25, ease: 'easeOut' },
  /** Rows follow the panel in, one after another. */
  itemStep: 0.035,
  itemRiseRem: 0.5,
} as const

/** Hero slide copy: children rise in sequence each time a slide becomes active. */
export const HERO = {
  step: 0.09,
  riseRem: 0.875,
  enter: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  /** Ken Burns on the active full-bleed image: 6% across 14s. */
  zoomScale: 1.06,
  zoomSeconds: 14,
} as const

/** Pixels in a rem, for Motion values that take px. Reads the live root size. */
export function remToPx(rem: number): number {
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return rem * (Number.isFinite(root) ? root : 16)
}
