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
