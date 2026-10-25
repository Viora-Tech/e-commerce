/*
 * The stepped checkout's state machine, as Figma Checkout: Contact → Address → Delivery
 * (shipping) → Payment. Pure, so it is tested on its own. The step lives in the URL (`?step=`),
 * so the browser's back and forward buttons move between steps and a reload stays put; the
 * gates decide how far a shopper may go. Nothing here is trusted: `checkoutAction` and
 * `placeOrder` re-check every field, rate and amount on the server.
 */

export const CHECKOUT_STEPS = ['contact', 'address', 'shipping', 'payment'] as const
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number]

/** The query parameter that holds the step. */
export const STEP_PARAM = 'step'

/**
 * Whether a step's own work is finished. `pending` while the answer is on its way (the
 * courier is quoting): the shopper cannot continue yet, but is not sent back either, so a
 * re-quote after a discount does not bounce them off the payment step.
 */
export type GateState = 'ok' | 'pending' | 'blocked'

/** One gate per step that has work to finish; payment ends the flow and has none. */
export type StepGates = { contact: GateState; address: GateState; shipping: GateState }

export type StepEvent = { type: 'next' } | { type: 'back' } | { type: 'goto'; step: CheckoutStep }

export type StepStatus = 'done' | 'current' | 'upcoming'

const DIGITAL_STEPS: readonly CheckoutStep[] = ['contact', 'address', 'payment']

/** Gift-card-only baskets are emailed: no shipping step. One array each, so effects can depend on it. */
export const stepsFor = (digitalOnly: boolean): readonly CheckoutStep[] =>
  digitalOnly ? DIGITAL_STEPS : CHECKOUT_STEPS

const isStep = (raw: string, steps: readonly CheckoutStep[]): raw is CheckoutStep =>
  (steps as readonly string[]).includes(raw)

/**
 * Where the plain `/checkout` link opens: Contact for a shopper who still has to sign in,
 * Address for one who is already known (signed in, or a guest the store allows).
 */
export function entryStep(gates: StepGates, steps: readonly CheckoutStep[]): CheckoutStep {
  return gates.contact === 'ok' && steps[1] ? steps[1] : (steps[0] as CheckoutStep)
}

/** The step a URL asks for; anything unknown (or missing) is the first step. */
export function parseStep(raw: string | null | undefined, steps: readonly CheckoutStep[]) {
  return raw && isStep(raw, steps) ? raw : (steps[0] as CheckoutStep)
}

const gateOf = (step: CheckoutStep, gates: StepGates): GateState =>
  step === 'payment' ? 'ok' : gates[step]

/**
 * Where a shopper asking for `wanted` lands: the first earlier step whose gate is blocked,
 * else `wanted`. A guest who reloads `?step=payment` with an empty form is shown Address.
 */
export function resolveStep(
  wanted: CheckoutStep,
  gates: StepGates,
  steps: readonly CheckoutStep[],
): CheckoutStep {
  const end = steps.indexOf(wanted)
  for (const step of steps.slice(0, Math.max(0, end))) {
    if (gateOf(step, gates) === 'blocked') return step
  }
  return end === -1 ? (steps[0] as CheckoutStep) : wanted
}

/** Continue is allowed only once the step's gate is open. */
export const canContinue = (step: CheckoutStep, gates: StepGates): boolean =>
  gateOf(step, gates) === 'ok'

/** A step the shopper may jump to: any earlier one, or a later one whose earlier gates are all open. */
export function canVisit(
  step: CheckoutStep,
  current: CheckoutStep,
  gates: StepGates,
  steps: readonly CheckoutStep[],
): boolean {
  const at = steps.indexOf(step)
  if (at === -1) return false
  if (at <= steps.indexOf(current)) return true
  return steps.slice(0, at).every((s) => gateOf(s, gates) === 'ok')
}

/**
 * The step after an event, and whether it moved. `next` waits at a gate that is not open
 * (the form then shows what to fix); `back` stops at the first step; `goto` only reaches
 * a step `canVisit` allows.
 */
export function transition(
  current: CheckoutStep,
  event: StepEvent,
  gates: StepGates,
  steps: readonly CheckoutStep[],
): { step: CheckoutStep; moved: boolean } {
  const at = steps.indexOf(current)
  const stay = { step: current, moved: false }
  if (event.type === 'back') {
    const prev = steps[at - 1]
    return prev ? { step: prev, moved: true } : stay
  }
  if (event.type === 'next') {
    const next = steps[at + 1]
    return next && canContinue(current, gates) ? { step: next, moved: true } : stay
  }
  if (event.step === current || !canVisit(event.step, current, gates, steps)) return stay
  return { step: event.step, moved: true }
}

/** How the progress bar draws a step. */
export function stepStatus(
  step: CheckoutStep,
  current: CheckoutStep,
  steps: readonly CheckoutStep[],
): StepStatus {
  const diff = steps.indexOf(step) - steps.indexOf(current)
  return diff < 0 ? 'done' : diff === 0 ? 'current' : 'upcoming'
}

/**
 * The URL for a step, keeping any other query parameters. Every step names itself, so going
 * back to Contact on purpose stays there; the plain `/checkout` link is the entry (`entryStep`).
 */
export function stepSearch(step: CheckoutStep, search: string): string {
  const params = new URLSearchParams(search)
  params.set(STEP_PARAM, step)
  const query = params.toString()
  return query ? `?${query}` : ''
}
