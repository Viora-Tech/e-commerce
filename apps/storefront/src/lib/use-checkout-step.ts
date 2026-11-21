import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  type CheckoutSection,
  resolveStep,
  type SectionGates,
  STEP_PARAM,
  sectionFromParam,
} from '@/lib/checkout-sections'
import { readStep, writeStep } from '@/lib/checkout-step-url'
import { useHeldStep } from '@/lib/use-held-step'

const toTop = () => requestAnimationFrame(() => window.scrollTo({ top: 0 }))

/**
 * The step on screen, kept in the URL (`?step=delivery`) so the phone's Back and Forward move
 * between steps (owner, 21 Nov 2026). A step the URL asks for (a reload, Back, a link) opens
 * only when every step before it is finished (`resolveStep`), and only once `settled` (the
 * tab's draft is back), so a reload on Delivery is not bounced before the draft's address is
 * in. Without a URL step it is the step the shopper picked, else the first one still open.
 */
export function useCheckoutStep(
  gates: SectionGates,
  sections: readonly CheckoutSection[],
  settled: boolean,
) {
  // Hooks
  const params = useSearchParams()
  /** The step the shopper chose; until then, the first one that still needs something. */
  const [picked, setPicked] = useState<CheckoutSection | null>(null)
  /** The step the URL asks for, until its earlier steps say whether it may open. */
  const [asked, setAsked] = useState(() => sectionFromParam(params.get(STEP_PARAM), sections))
  const held = useHeldStep(picked, gates, sections)
  const resolved = asked ? resolveStep(asked, gates, sections) : null
  if (resolved && settled && resolved.kind !== 'wait') {
    setAsked(null)
    setPicked(resolved.step)
  }
  const step = resolved?.step ?? held
  // Whatever the page shows by itself (opening, falling back, a field to fix) replaces the
  // URL's step: no extra history entry.
  useEffect(() => {
    if (settled && asked === null) writeStep(step, 'replace')
  }, [settled, asked, step])
  // Back and Forward: the URL's step, checked like any link.
  useEffect(() => {
    const handlePop = () => {
      setPicked(null)
      setAsked(readStep(sections))
      toTop()
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [sections])

  return {
    step,
    /*
     * A move the shopper makes (Continue, the stepper, "Back to …", a review row's Change)
     * pushes a history entry, backwards too: Back then undoes the last move, the way it does
     * on any page, rather than jumping somewhere the shopper did not just come from.
     */
    go: (section: CheckoutSection) => {
      setAsked(null)
      setPicked(section)
      writeStep(section, 'push')
      toTop()
    },
    /** A step the page sends the shopper to (Pay found something to fix): replaces the URL's. */
    pick: (section: CheckoutSection) => {
      setAsked(null)
      setPicked(section)
    },
    /** The first touch of a field holds the step, so it never moves on by itself. */
    hold: () => setPicked((p) => p ?? step),
  }
}
