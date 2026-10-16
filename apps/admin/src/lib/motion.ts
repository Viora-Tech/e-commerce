import type { Transition } from 'motion/react'

/**
 * Shared timings. Everything in the admin moves in 150–250ms with an
 * ease-out; only the active pill uses a stiff spring so it settles without
 * overshoot. Components check `useReducedMotion()` and pass `instant` instead.
 */
/** Same curve as the `--ease-out` token in @commerce/ui styles.css (docs/conventions.md, "Motion"). */
export const EASE_OUT: readonly [number, number, number, number] = [0.23, 1, 0.32, 1]

/** Something moving across the screen (docs/conventions.md, "Motion"). */
export const EASE_IN_OUT: readonly [number, number, number, number] = [0.77, 0, 0.175, 1]

/** Sheets and drawers (docs/conventions.md, "Motion"). */
export const EASE_DRAWER: readonly [number, number, number, number] = [0.32, 0.72, 0, 1]

export const fast: Transition = { duration: 0.15, ease: EASE_OUT }
export const base: Transition = { duration: 0.2, ease: EASE_OUT }
export const slow: Transition = { duration: 0.25, ease: EASE_OUT }

/** Active pill slide: stiff, critically damped, no bounce. */
export const pill: Transition = { type: 'spring', stiffness: 700, damping: 50, mass: 0.6 }

export const instant: Transition = { duration: 0 }

/** Stat number count-up on first paint. */
export const COUNT_UP_MS = 600

/**
 * Home polish moments (see the Home motion spec): every duration in one place so the
 * page's micro-animations stay in sync. Seconds below are the same numbers in ms.
 */
export const MOTION_MS = {
  hover: 150,
  press: 160,
  base: 200,
  enter: 250,
  layout: 300,
  rollingText: 350,
  count: 600,
  draw: 700,
  ambient: 2000,
  stagger: 40,
  rotateEvery: 2600,
  rotateFirst: 4000,
  askRotateEvery: 4000,
} as const

/** Pressed cards shrink here; entering cards start here (docs/conventions.md, "Motion"). */
export const PRESS_SCALE = 0.97
export const ENTER_SCALE = 0.96

/** Sections settle with an 8px rise; to-do cards lift 2px on hover. */
export const ENTER_RISE_PX = 8
export const LIFT_PX = 2

/** Sections settle, one after another, on the first Home visit of a session. */
export const enter: Transition = { duration: MOTION_MS.enter / 1000, ease: EASE_OUT }

/** Grids reflow when a card leaves; collapsible panels open over this time. */
export const layout: Transition = { duration: MOTION_MS.layout / 1000, ease: EASE_OUT }

/** Session flag: Home's sections already settled once, so later visits appear at once. */
export const HOME_ENTERED_KEY = 'home-entered'
