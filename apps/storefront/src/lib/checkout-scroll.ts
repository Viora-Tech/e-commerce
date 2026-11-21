/*
 * The checkout's scrolling: bringing what stops Pay into view. The step a link names lives in
 * the URL (`lib/checkout-step-url.ts`). Browser only (called from effects and handlers).
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

/** Press the code button: on a phone the bottom bar stands in for it. False when it is not there. */
export function pressSendCode(id: string): boolean {
  const button = document.getElementById(id)
  button?.click()
  return button !== null
}
