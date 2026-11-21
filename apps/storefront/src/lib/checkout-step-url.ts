import {
  type CheckoutSection,
  STEP_PARAM,
  sectionFromParam,
  stepParam,
} from '@/lib/checkout-sections'

/*
 * The checkout's step in the address bar (`/checkout?step=delivery`), so a phone's Back button
 * moves between steps instead of leaving checkout (owner, 21 Nov 2026). The native history API
 * is used on purpose: Next's app router syncs it with `useSearchParams` and neither re-renders
 * the server page nor fetches it again. Every other query parameter is kept.
 */

/** The address with this step in it, or null when it already says so. Pure. */
export function stepHref(href: string, section: CheckoutSection): string | null {
  const url = new URL(href)
  const value = stepParam(section)
  if (url.searchParams.get(STEP_PARAM) === value) return null
  url.searchParams.set(STEP_PARAM, value)
  return `${url.pathname}${url.search}${url.hash}`
}

/** The step the address bar names now, or null. Browser only. */
export const readStep = (sections: readonly CheckoutSection[]): CheckoutSection | null =>
  sectionFromParam(new URL(window.location.href).searchParams.get(STEP_PARAM), sections)

/**
 * Put the step in the address bar. `push` for a move the shopper made (Back then undoes it);
 * `replace` for one the page made (opening, a link that may not skip ahead, a field to fix), so
 * Back never lands on a step that would only send the shopper on again. Browser only.
 */
export function writeStep(section: CheckoutSection, mode: 'push' | 'replace'): void {
  const next = stepHref(window.location.href, section)
  if (next === null) return
  if (mode === 'push') window.history.pushState(null, '', next)
  else window.history.replaceState(null, '', next)
}
