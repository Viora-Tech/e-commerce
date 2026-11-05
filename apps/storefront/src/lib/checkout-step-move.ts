import type { CheckoutSection, GateState } from '@/lib/checkout-sections'
import { nextSection } from '@/lib/checkout-sections'

type StepMove = {
  step: CheckoutSection
  sections: readonly CheckoutSection[]
  done: { contact: boolean; address: boolean }
  shipping: GateState
}

/** What Continue does on this step: move on, or say what the step still needs. */
export function stepMove({ step, sections, done, shipping }: StepMove) {
  if (step === 'shipping' && shipping !== 'ok') {
    return { kind: shipping === 'blocked' ? ('pick-shipping' as const) : ('wait' as const) }
  }
  if ((step === 'contact' && !done.contact) || (step === 'address' && !done.address)) {
    return { kind: 'fix' as const }
  }
  return { kind: 'next' as const, to: nextSection(step, sections) }
}

/** How many wrong fields this step shows: the other steps' are not on screen. */
export const fieldsOnStep = <Key extends string>(
  wrong: readonly Key[],
  contactKeys: readonly Key[],
  step: CheckoutSection,
): number => wrong.filter((key) => contactKeys.includes(key) === (step === 'contact')).length
