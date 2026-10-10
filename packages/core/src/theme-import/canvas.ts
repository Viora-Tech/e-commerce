/** SOURCE OF TRUTH: imported theme markup for the Customize canvas — WHAT: the theme's rendered head and sections with everything that can run removed (scripts, frames, handlers, script URLs) / WHY: the canvas is an iframe on the admin's origin; a theme's code may only ever run on its own storefront */
import { sanitizeCanvasHtml } from '@commerce/blocks/canvas-html'

/** Theme markup safe to put into the admin's canvas: the look stays, nothing can run. */
export function canvasSafeHtml(html: string): string {
  return sanitizeCanvasHtml(html)
}
