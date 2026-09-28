/**
 * The theme editor's chrome scale, in one place so every panel reads as one
 * system (the calm, dense look of Framer, Linear and Shopify's editor):
 *
 * - type: 13px body, 12px labels, 11px meta; headings semibold with tight
 *   tracking; figures tabular; sentence case everywhere, never all caps
 * - rows: 32px tall on a 4px grid, 8px radius, a soft `muted/60` hover, and
 *   selected = a 10% accent wash plus a 2px accent bar on the left edge
 * - panels: 12px radius, hairline token borders
 * - motion: colour transitions at 150ms, off under reduced motion
 * - focus: a visible 2px ring in the accent on every interactive element
 *
 * Sizes are rem (0.25rem = 4px). Plain strings, no JSX, so this sits outside
 * the component-structure rule.
 */

/** Colour-only transition every hoverable row and button uses. */
export const CHROME_TRANSITION = 'transition-colors duration-150 motion-reduce:transition-none'

/** A visible keyboard focus ring, drawn inside so rows in a scroller aren't clipped. */
export const CHROME_FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset'

/** 13px body text. */
export const CHROME_BODY = 'text-[0.8125rem] leading-5'

/** 12px label text. */
export const CHROME_LABEL = 'text-xs leading-4 font-medium'

/** 11px meta text: counts, hints, "by <app>". */
export const CHROME_META = 'text-[0.6875rem] leading-4 text-muted-foreground tabular-nums'

/** A group heading inside a panel: 11px medium muted, sentence case (never all caps). */
export const CHROME_GROUP_LABEL = 'text-[0.6875rem] leading-4 font-medium text-muted-foreground'

/** Panel and dialog titles: 13px semibold, tight tracking. */
export const CHROME_HEADING = 'text-[0.8125rem] leading-5 font-semibold tracking-tight'

/** The 32px row every list in the sidebars uses. */
export const CHROME_ROW = 'relative flex h-8 items-center rounded-lg text-[0.8125rem]'

/** Row hover. */
export const CHROME_ROW_HOVER = 'hover:bg-muted/60 hover:text-foreground'

/**
 * Selected row: a 10% accent wash and a 2px accent bar at the left edge
 * (a pseudo-element, so it costs no layout). Pair with `relative`.
 */
export const CHROME_ROW_SELECTED =
  'bg-primary/10 text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'

/** The fade behind a row's trailing actions, matching the row's own background. */
export const CHROME_ROW_FADE = 'from-card via-card'

/** A floating side panel on the editor backdrop. */
export const CHROME_PANEL =
  'flex shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card'

/** A small square icon button in the chrome (row actions, panel header actions). */
export const CHROME_ICON_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5'
