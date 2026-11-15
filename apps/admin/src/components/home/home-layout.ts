/**
 * Home's layout classes, shared by the page (`dashboard-page.tsx` and its sections) and its
 * loading picture (`layout/dashboard-skeleton.tsx`), so the skeleton is drawn from the same
 * boxes and nothing moves when the page arrives. A plain module (not 'use client'): the
 * server-rendered skeleton reads these strings as values.
 */

/** Home keeps its own 2.5rem rhythm between sections (owner's choice; other pages use 1.5rem). */
export const HOME_RHYTHM = 'gap-10'

/** The greeting and Ask AI column: 48rem, centred above the 68rem page. */
export const HOME_NARROW = 'mx-auto flex w-full max-w-[48rem] flex-col gap-10'

/** A titled group of tiles (To do, Finish setup, Suggested for you): heading, then the tiles. */
export const HOME_SECTION = 'flex flex-col gap-3.5'

/** Latest orders beside Live now: 640fr to 424fr from `xl`, stacked below it. */
export const HOME_SPLIT = 'grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,640fr)_minmax(0,424fr)]'

/** The sales hero card: the one card radius on the glass surface. */
export const HERO_SHELL = 'relative isolate flex flex-col overflow-hidden rounded-lg surface-glass'

/** The hero's top row: range, compare and channel pills, the live count, Customize. */
export const HERO_TOOLBAR = 'flex flex-wrap items-center gap-2 pt-4 pr-4 pb-2 pl-5'

/** The hero's filter pills are 2rem tall (Figma "Analytics · Filter button" 580:694). */
export const HERO_PILL_HEIGHT = 'h-8'

/** The row that holds the metric tiles. */
export const HERO_TILES_ROW = 'px-3 py-1'

/** The chart under the tiles, and its height. */
export const HERO_CHART_ROW = 'min-w-0 px-5 pt-3'
export const HERO_CHART = 'h-55 w-full'

/** The legend and "View report" line at the bottom of the hero. */
export const HERO_FOOTER = 'flex flex-wrap items-center justify-between gap-3 px-5 pt-3 pb-4'

/** Four metric tiles: one column on phones, two from `sm`, four from `lg`. */
export const TILE_GRID = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'

/** One metric tile's box (Figma 583:1865). */
export const TILE_BOX = 'relative isolate flex flex-col gap-1 rounded-lg border px-4 py-3 text-left'

/** The tile's label: the caption token at Figma's 1.25rem line, with a dotted underline. */
export const TILE_LABEL =
  'text-caption leading-5 text-muted-foreground underline decoration-dotted underline-offset-4'

/** The tile's figure: the mid stat token (1.5rem/1.8125rem semibold, -0.02em). */
export const TILE_VALUE = 'text-stat-md whitespace-nowrap text-ink-strong tabular-nums'

/** The tile's change or note line: the period token (0.75rem/1rem). */
export const TILE_NOTE = 'text-period text-muted-foreground'

/** To-do tiles: one column, two from `md`, three from `xl`. */
export const TODO_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'

/** One to-do tile (clickable tiles keep `surface-card card-lift` at the card radius). */
export const TODO_TILE = 'flex h-full flex-col items-start gap-3.5 rounded-lg p-5 surface-card'

/** Suggested for you: two columns from `md`; a card is a 6rem picture in 0.875rem padding. */
export const SUGGEST_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2'
export const SUGGEST_CARD_HEIGHT = 'h-31'

/** One Latest orders row. */
export const ORDER_ROW = 'flex items-center gap-3.5 px-5 py-3.5'

/** How many orders Latest orders lists. */
export const LATEST_ROWS = 5

/** The globe strip at the foot of Live now (fixed, so the card does not grow as cobe loads). */
export const LIVE_GLOBE = 'h-[14rem]'
