/*
 * The checkout's steps (Figma: Checkout · Polish): Contact, Delivery, Shipping and Payment, one
 * on screen at a time inside the one form, so every field still goes with the order. Pure, so
 * it is tested on its own. A step is finished when its gate is open, and Pay points at the first
 * step that still needs something. Nothing here is trusted: `checkoutAction` and `placeOrder`
 * re-check every field, rate and amount on the server.
 */

export const CHECKOUT_SECTIONS = ['contact', 'address', 'shipping', 'payment'] as const
export type CheckoutSection = (typeof CHECKOUT_SECTIONS)[number]

/**
 * Whether a section's own work is finished. `pending` while the answer is on its way (the
 * courier is quoting): Pay waits, but nothing is flagged as wrong.
 */
export type GateState = 'ok' | 'pending' | 'blocked'

/** One gate per section that has work to finish; payment ends the page and has none. */
export type SectionGates = { contact: GateState; address: GateState; shipping: GateState }

const DIGITAL_SECTIONS: readonly CheckoutSection[] = ['contact', 'address', 'payment']

/** Gift-card-only baskets are emailed: no shipping section. */
export const sectionsFor = (digitalOnly: boolean): readonly CheckoutSection[] =>
  digitalOnly ? DIGITAL_SECTIONS : CHECKOUT_SECTIONS

/** The query parameter a link keeps its step in (`?step=payment`). */
export const LEGACY_STEP_PARAM = 'step'

/**
 * The section a `?step=` link points at, or null. Anything else (unknown, empty, a section this
 * basket has not got) is ignored. It never decides what the shopper may do.
 */
export function sectionFromParam(
  raw: string | null | undefined,
  sections: readonly CheckoutSection[],
): CheckoutSection | null {
  const value = raw?.trim().toLowerCase() ?? ''
  return (sections as readonly string[]).includes(value) ? (value as CheckoutSection) : null
}

/** The card's DOM id, which a scroll or a skip link targets. */
export const sectionDomId = (section: CheckoutSection): string => `checkout-section-${section}`

/** The heading inside each card, labelling it for assistive tech. */
export const sectionHeadingId = (section: CheckoutSection): string =>
  `checkout-section-${section}-title`

/** The first section whose gate is not open, in page order; null when Pay can go ahead. */
export function firstOpenSection(
  gates: SectionGates,
  sections: readonly CheckoutSection[],
): CheckoutSection | null {
  for (const s of sections) {
    if (s !== 'payment' && gates[s] !== 'ok') return s
  }
  return null
}

/** The step after this one; null on the last. */
export function nextSection(
  section: CheckoutSection,
  sections: readonly CheckoutSection[],
): CheckoutSection | null {
  return sections[sections.indexOf(section) + 1] ?? null
}
