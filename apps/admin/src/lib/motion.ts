import type { Transition } from 'motion/react'

/**
 * Shared timings. Everything in the admin moves in 150–250ms with an
 * ease-out; only the active pill uses a stiff spring so it settles without
 * overshoot. Components check `useReducedMotion()` and pass `instant` instead.
 */
export const EASE_OUT: readonly [number, number, number, number] = [0.22, 1, 0.36, 1]

export const fast: Transition = { duration: 0.15, ease: EASE_OUT }
export const base: Transition = { duration: 0.2, ease: EASE_OUT }
export const slow: Transition = { duration: 0.25, ease: EASE_OUT }

/** Active pill slide: stiff, critically damped, no bounce. */
export const pill: Transition = { type: 'spring', stiffness: 700, damping: 50, mass: 0.6 }

export const instant: Transition = { duration: 0 }

/** Stat number count-up on first paint. */
export const COUNT_UP_MS = 600
