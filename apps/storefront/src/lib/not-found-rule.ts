export type NotFoundRequest = {
  /** The store renders an imported Shopify theme. */
  imported: boolean
  /** Answered with the RSC payload alone (a client navigation, an action). */
  flightOnly: boolean
  /** The themed reload of a not-found page (`lib/themed-rerender.ts`). */
  rerender: boolean
}

/**
 * Whether the not-found boundary needs the theme's 404 markup in this answer. Next puts the
 * boundary's fallback in the RSC payload of every page, so under an imported theme each product,
 * collection and content page carried the 404 template's sections inline (about 67 KB on Waimers)
 * and rendered them on every cache miss, for a fallback almost never shown.
 *
 * Under an imported theme a page load never draws it either: a real 404 comes back as Next's
 * empty error shell, its Liquid slots find no server markup, and the browser reloads once in the
 * themed mode, where the boundary is drawn. So the markup is needed only on that reload, on a
 * payload-only answer (a client navigation can land on a missing page), and for our own themes,
 * whose 404 is drawn from the payload on the first load.
 */
export function needsNotFoundMarkup(request: NotFoundRequest): boolean {
  return !request.imported || request.flightOnly || request.rerender
}
