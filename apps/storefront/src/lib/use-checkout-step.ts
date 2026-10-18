import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  type CheckoutStep,
  entryStep,
  parseStep,
  resolveStep,
  STEP_PARAM,
  type StepEvent,
  type StepGates,
  stepSearch,
  transition,
} from '@/lib/checkout-steps'

/** The heading each step panel draws; focus lands on it when the step changes. */
export const stepHeadingId = (step: CheckoutStep): string => `checkout-step-${step}`

const urlFor = (step: CheckoutStep): string =>
  `${window.location.pathname}${stepSearch(step, window.location.search)}`

/**
 * The step on screen, kept in the URL. Moving pushes a history entry, so the browser's back
 * and forward buttons walk the steps (Next syncs `useSearchParams` with `history.pushState`,
 * and nothing is fetched from the server). A step the gates refuse is shown as the step that
 * needs work and corrected in the URL without a new entry, once `settled` says the saved
 * draft has been read back (before that the gates only know the server's prefill).
 */
export function useCheckoutStep(
  steps: readonly CheckoutStep[],
  gates: StepGates,
  settled: boolean,
) {
  const params = useSearchParams()
  const raw = params.get(STEP_PARAM)
  const wanted = raw ? parseStep(raw, steps) : entryStep(gates, steps)
  const step = resolveStep(wanted, gates, steps)
  const shown = useRef<CheckoutStep | null>(null)

  useEffect(() => {
    if (settled && step !== wanted) window.history.replaceState(null, '', urlFor(step))
  }, [settled, step, wanted])

  // A new step starts at the top, with focus on its heading so a screen reader announces it.
  useEffect(() => {
    if (!settled) return
    if (shown.current !== null && shown.current !== step) {
      window.scrollTo({ top: 0 })
      document.getElementById(stepHeadingId(step))?.focus({ preventScroll: true })
    }
    shown.current = step
  }, [settled, step])

  /** Apply an event; returns whether the step moved (a closed gate keeps it). */
  const go = (event: StepEvent): boolean => {
    const next = transition(step, event, gates, steps)
    if (next.moved) window.history.pushState(null, '', urlFor(next.step))
    return next.moved
  }

  return { step, go }
}
