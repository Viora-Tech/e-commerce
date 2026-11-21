/**
 * The postMessage protocol between Customize and the storefront page it shows with an imported
 * theme's scripts running (the "Theme scripts" canvas). The theme's JavaScript may only run on the
 * store's own address, never inside the admin, so this page is the storefront itself in a frame,
 * opened with a signed preview token and `?theme-design-mode=1`.
 *
 * - The storefront says `ready` once its bridge is listening (and again after any reload).
 * - Customize answers with `state`: every imported section on the page, in order, with the
 *   unsaved settings, and which section and block are selected. It sends `state` again on each
 *   change; the storefront works out what changed and fires Shopify's theme editor events
 *   (`shopify:section:load`, `:unload`, `:reorder`, `:select`, `:deselect`, `shopify:block:select`,
 *   `:deselect`) so the theme's scripts re-initialise, as they do in Shopify's editor.
 * - A click on a section in the page sends `clicked` back, and Customize selects it.
 */
export const THEME_DESIGN_MODE_PARAM = 'theme-design-mode'

/** One imported section as Customize has it now. */
export type DesignModeSection = {
  /** Shopify's `section.id` (`template--123__hero`); the page wraps it in `#shopify-section-<id>`. */
  id: string
  /** The placement the storefront renders (`LiquidSectionPlacement`); validated there. */
  placement: unknown
}

export type DesignModeSelection = { sectionId: string; blockId: string | null } | null

export type DesignModeReady = { type: 'theme-design:ready' }

export type DesignModeState = {
  type: 'theme-design:state'
  /** Sections by group (`template`, `header-group`, `footer-group`), each in page order. */
  zones: Record<string, DesignModeSection[]>
  selected: DesignModeSelection
}

export type DesignModeClicked = {
  type: 'theme-design:clicked'
  sectionId: string
  blockId: string | null
}

export type DesignModeMessage = DesignModeReady | DesignModeState | DesignModeClicked

const TYPES = new Set(['theme-design:ready', 'theme-design:state', 'theme-design:clicked'])

export function isDesignModeMessage(data: unknown): data is DesignModeMessage {
  if (typeof data !== 'object' || data === null) return false
  return TYPES.has(String((data as { type?: unknown }).type))
}

/** The page Customize frames: the store page with its preview token and design mode on. */
export function designModeUrl(origin: string, token: string, path = '/'): string {
  return `${origin}${path}?theme-preview=${encodeURIComponent(token)}&${THEME_DESIGN_MODE_PARAM}=1`
}
