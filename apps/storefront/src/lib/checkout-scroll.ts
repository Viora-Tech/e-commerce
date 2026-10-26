import {
  type CheckoutSection,
  LEGACY_STEP_PARAM,
  sectionDomId,
  sectionFromParam,
} from '@/lib/checkout-sections'

/*
 * The one-page checkout's scrolling: bringing what stops Pay into view, and following an old
 * stepped-checkout link to its card. Browser only (called from effects and handlers).
 */

/** Smooth, unless the shopper asked for reduced motion: then it jumps. */
const scrollBehaviour = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/** Scroll something into view and focus it (a field, a button, a card). */
export function bringIntoView(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: scrollBehaviour() })
  el.focus({ preventScroll: true })
}

/**
 * An old stepped-checkout link (`?step=payment`): scroll to that card once, then drop the
 * parameter so a reload opens the page from the top. Unknown values are ignored; the link
 * never decides what the shopper may do.
 */
export function followLegacyStep(sections: readonly CheckoutSection[]): void {
  const url = new URL(window.location.href)
  const raw = url.searchParams.get(LEGACY_STEP_PARAM)
  if (raw === null) return
  url.searchParams.delete(LEGACY_STEP_PARAM)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  const section = sectionFromParam(raw, sections)
  if (section && section !== 'contact') {
    document.getElementById(sectionDomId(section))?.scrollIntoView({ block: 'start' })
  }
}
