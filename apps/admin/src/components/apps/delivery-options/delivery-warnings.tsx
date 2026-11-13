'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import type { Overview } from './format'

type DeliveryWarningsProps = {
  warnings: Overview['warnings']
}

/** What stops the app from working as set up (no options, no courier, insurance unpriced). */
export default function DeliveryWarnings({ warnings }: DeliveryWarningsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  return warnings.map((w) => (
    <p
      key={w}
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-body text-ink-strong"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      {copy.warnings[w]}
    </p>
  ))
}
