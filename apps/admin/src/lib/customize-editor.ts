import { THEME_FONT_IDS, THEME_FONTS } from '@commerce/core/theme'
import type { Data, PuckAction } from '@puckeditor/core'
import { prefersReducedMotion, scrollToSection } from '@/lib/customize-canvas-motion'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { zoneItems } from '@/lib/customize-slots'

/** Curated Google Fonts for picker samples and the preview (the storefront self-hosts them). */
export const FONT_SAMPLES = `https://fonts.googleapis.com/css2?${THEME_FONT_IDS.map(
  (id) => `family=${THEME_FONTS[id].google}`,
).join('&')}&display=swap`

/** Save's only refusal is a connected setting whose source is gone; its message names it. */
export const isSourceError = (err: unknown): err is Error =>
  err instanceof Error && (err as { code?: unknown }).code === 'BAD_REQUEST'

/**
 * Every way a section gets added — a click in the Add panel, the Sections
 * tree's "Add section" popover, or a card dragged onto the canvas — ends in
 * one Puck `insert` action, so this is the one place that brings the new
 * section into view. (Selection is already handled: a click selects it
 * itself, and Puck selects a dropped one.)
 */
export function revealInserted(action: PuckAction, next: { data: Data }): void {
  if (action.type !== 'insert') return
  const doc = next.data as unknown as CustomizeDoc
  const id = action.id ?? zoneItems(doc, action.destinationZone)[action.destinationIndex]?.props.id
  if (id) scrollToSection(id, prefersReducedMotion())
}

/** Two template refs name the same page. */
export const sameRef = (a: TemplateRefLike, b: TemplateRefLike) =>
  a.key === b.key && a.suffix === b.suffix

/** How long the first page may take before the loading screen says it could not be reached. */
export const LOAD_TIMEOUT_MS = 20_000

/** The canvas shows the default home page at desktop width: what the Themes page pictures. */
export const isDesktopHome = (loaded: { ref: TemplateRefLike } | null, device: string) =>
  loaded?.ref.key === 'home' && loaded.ref.suffix === '' && device === 'desktop'

type TemplateRefLike = { key: string; suffix: string }
