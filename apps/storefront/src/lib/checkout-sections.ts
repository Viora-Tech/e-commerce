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

/** The query parameter the step on screen lives in (`/checkout?step=payment`). */
export const STEP_PARAM = 'step'

/** Each step's word in the URL: the shopper reads Shipping as "Delivery", so the link does too. */
export const stepParam = (section: CheckoutSection): string =>
  section === 'shipping' ? 'delivery' : section

/**
 * The section a `?step=` value points at, or null. `delivery` is Shipping; older links saying
 * `shipping` still work. Anything else (unknown, empty, a section this basket has not got) is
 * ignored. It never decides what the shopper may do: `resolveStep` does.
 */
export function sectionFromParam(
  raw: string | null | undefined,
  sections: readonly CheckoutSection[],
): CheckoutSection | null {
  const value = raw?.trim().toLowerCase() ?? ''
  const section = value === 'delivery' ? 'shipping' : value
  return (sections as readonly string[]).includes(section) ? (section as CheckoutSection) : null
}

/**
 * Where a step the URL asks for may open. `show`: every step before it is finished. `wait`: one
 * is still on its way (the courier is quoting the address a reload brought back), so the page
 * holds instead of bouncing. `fall-back`: one is not finished, so the first unfinished step opens
 * and the URL follows it. A link never skips a step.
 */
export function resolveStep(
  asked: CheckoutSection,
  gates: SectionGates,
  sections: readonly CheckoutSection[],
): { kind: 'show' | 'wait' | 'fall-back'; step: CheckoutSection } {
  let waiting = false
  for (const s of sections.slice(0, Math.max(0, sections.indexOf(asked)))) {
    if (s === 'payment') continue
    if (gates[s] === 'blocked') {
      return { kind: 'fall-back', step: firstOpenSection(gates, sections) ?? s }
    }
    if (gates[s] === 'pending') waiting = true
  }
  return { kind: waiting ? 'wait' : 'show', step: asked }
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
